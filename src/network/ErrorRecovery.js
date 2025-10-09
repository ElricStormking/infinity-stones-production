// NetworkErrorRecovery - handles transient network failures for spin requests

window.NetworkErrorRecovery = class NetworkErrorRecovery {
    constructor(gameAPI) {
        this.gameAPI = gameAPI;
        this.pendingSpins = new Map();
        this.maxReconnectAttempts = 5;
        this.baseDelayMs = 500;
        this.pendingRetentionMs = 5 * 60 * 1000; // 5 minutes
    }

    async handleSpinRequest(request, executor) {
        if (typeof executor !== 'function') {
            throw new Error('NetworkErrorRecovery requires an executor callback');
        }

        this.prunePendingRequests();

        const enrichedRequest = Object.assign({
            requestId: (request && request.requestId) ? request.requestId : this.generateRequestId(),
            createdAt: Date.now()
        }, request);

        const entry = {
            request: enrichedRequest,
            executor,
            status: 'pending',
            attempts: 0,
            lastError: null,
            createdAt: Date.now()
        };
        this.pendingSpins.set(enrichedRequest.requestId, entry);

        try {
            const result = await executor(enrichedRequest);
            this.markResolved(enrichedRequest.requestId);
            return result;
        } catch (error) {
            if (!this.isNetworkError(error)) {
                this.pendingSpins.delete(enrichedRequest.requestId);
                throw error;
            }
            entry.lastError = error;
            entry.status = 'recovering';
            return await this.handleNetworkError(enrichedRequest, executor, error);
        }
    }

    async handleNetworkError(request, executor, originalError) {
        const entry = this.pendingSpins.get(request.requestId);
        this.notifyStatus('reconnecting', { requestId: request.requestId, error: originalError });

        for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
            const delay = this.getDelayForAttempt(attempt);
            await this.wait(delay);
            this.notifyStatus('retry', { requestId: request.requestId, attempt, delay });

            if (entry) {
                entry.attempts = attempt;
                entry.status = 'recovering';
            }

            try {
                const pending = await this.checkPendingResult(request.requestId);
                if (pending) {
                    this.markResolved(request.requestId);
                    this.notifyStatus('recovered', { requestId: request.requestId, attempt, recoveredFromCache: true });
                    return pending;
                }

                const result = await executor(request);
                this.markResolved(request.requestId);
                this.notifyStatus('recovered', { requestId: request.requestId, attempt, recoveredFromCache: false });
                return result;
            } catch (error) {
                if (entry) {
                    entry.lastError = error;
                }
                if (!this.isNetworkError(error)) {
                    this.pendingSpins.delete(request.requestId);
                    throw error;
                }
            }
        }

        if (entry) {
            entry.status = 'failed';
            entry.failedAt = Date.now();
            entry.lastError = originalError;
        }

        const failure = new Error('Unable to recover from network error');
        failure.originalError = originalError;
        this.notifyStatus('failed', { requestId: request.requestId, error: failure });
        throw failure;
    }

    async retryPendingRequests(options = {}) {
        const outcomes = [];
        this.prunePendingRequests();

        for (const [requestId, entry] of this.pendingSpins.entries()) {
            if (entry.status === 'resolved') {
                this.pendingSpins.delete(requestId);
                continue;
            }
            if (options.onlyFailed && entry.status !== 'failed') {
                continue;
            }

            try {
                this.notifyStatus('manual-retry', { requestId, attempts: entry.attempts, lastError: entry.lastError });
                const result = await this.attemptImmediateRecovery(entry);
                this.markResolved(requestId);
                outcomes.push({ requestId, status: 'recovered', result });
                const recoveredFromCache = !!(result && result.success && result.data && result.data.cascades);
                this.notifyStatus('recovered', { requestId, manual: true, recoveredFromCache });
            } catch (error) {
                entry.lastError = error;
                entry.status = 'failed';
                entry.failedAt = Date.now();
                outcomes.push({ requestId, status: 'failed', error });
                this.notifyStatus('failed', { requestId, manual: true, error });
            }
        }

        return outcomes;
    }

    async attemptImmediateRecovery(entry) {
        const requestId = entry.request.requestId;
        const pending = await this.checkPendingResult(requestId);
        if (pending) {
            return pending;
        }
        return await entry.executor(entry.request);
    }

    async checkPendingResult(requestId) {
        if (this.gameAPI && typeof this.gameAPI.fetchPendingResult === 'function') {
            try {
                const pending = await this.gameAPI.fetchPendingResult(requestId);
                if (pending && pending.success) {
                    return pending;
                }
            } catch (error) {
                console.warn('Pending result lookup failed:', error.message);
            }
        }
        return null;
    }

    isNetworkError(error) {
        if (!error) {
            return false;
        }
        if (error.code && ['ECONNRESET', 'ECONNABORTED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) {
            return true;
        }
        if (error.message && /(network|timeout|offline|connection)/i.test(error.message)) {
            return true;
        }
        if (error.response && error.response.status && error.response.status >= 500) {
            return true;
        }
        return false;
    }

    notifyStatus(type, detail = {}) {
        if (this.gameAPI && typeof this.gameAPI.notifyNetworkStatus === 'function') {
            this.gameAPI.notifyNetworkStatus(type, detail);
            return;
        }

        try {
            const event = new CustomEvent('game-network-status', { detail: Object.assign({ type }, detail) });
            window.dispatchEvent(event);
        } catch (error) {
            console.warn('Failed to dispatch network status event:', error);
        }
    }

    getDelayForAttempt(attempt) {
        return Math.min(4000, this.baseDelayMs * Math.pow(2, attempt - 1));
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    prunePendingRequests(maxAgeMs) {
        const retention = typeof maxAgeMs === 'number' ? maxAgeMs : this.pendingRetentionMs;
        const threshold = Date.now() - retention;
        for (const [requestId, entry] of this.pendingSpins.entries()) {
            const timestamp = entry.resolvedAt || entry.failedAt || entry.createdAt;
            if (timestamp && timestamp < threshold) {
                this.pendingSpins.delete(requestId);
            }
        }
    }

    markResolved(requestId) {
        const entry = this.pendingSpins.get(requestId);
        if (entry) {
            entry.status = 'resolved';
            entry.resolvedAt = Date.now();
        }
        this.pendingSpins.delete(requestId);
    }

    generateRequestId() {
        const random = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
        return `spin-${Date.now()}-${random}`;
    }
};
