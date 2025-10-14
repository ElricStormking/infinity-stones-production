// ErrorRecovery.js - Network error recovery and resilience system

window.NetworkErrorRecovery = class NetworkErrorRecovery {
    constructor(networkService, gameScene) {
        this.networkService = networkService || window.NetworkService;
        this.gameScene = gameScene;
        
        // Pending spin tracking
        this.pendingSpins = new Map(); // requestId -> { request, timestamp, attempts }
        
        // Reconnection state
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectBackoffBase = 1000; // 1 second base
        this.isReconnecting = false;
        
        // UI overlay references
        this.reconnectingOverlay = null;
        this.errorOverlay = null;
        
        // Recovery state
        this.lastSuccessfulRequest = null;
        this.recoveryMode = false;
        this.offlineQueue = [];
        
        // Configuration
        this.config = {
            requestTimeout: 15000,
            maxPendingSpins: 5,
            enableOfflineQueue: true,
            maxOfflineQueue: 10,
            retryDelayMs: 1000,
            maxRetryAttempts: 3
        };
        
        console.log('🔄 NetworkErrorRecovery initialized');
    }
    
    /**
     * Enhanced spin request with automatic recovery
     */
    async handleSpinRequest(spinRequest) {
        const requestId = this.generateRequestId();
        const request = {
            ...spinRequest,
            requestId,
            timestamp: Date.now()
        };
        
        // Check if we're online
        if (!navigator.onLine && this.config.enableOfflineQueue) {
            return this.queueOfflineRequest(request);
        }
        
        // Store pending request
        this.pendingSpins.set(requestId, {
            request,
            timestamp: Date.now(),
            attempts: 0
        });
        
        try {
            // Execute spin request with timeout
            const result = await this.executeWithTimeout(
                () => this.networkService.processSpin(request),
                this.config.requestTimeout
            );
            
            // Success - remove from pending
            this.pendingSpins.delete(requestId);
            this.lastSuccessfulRequest = Date.now();
            this.reconnectAttempts = 0;
            
            return result;
            
        } catch (error) {
            console.error('🔴 Spin request failed:', error.message);
            
            // Handle different error types
            if (this.isNetworkError(error)) {
                return await this.handleNetworkError(request, error);
            } else if (this.isServerError(error)) {
                return await this.handleServerError(request, error);
            } else if (this.isTimeoutError(error)) {
                return await this.handleTimeoutError(request, error);
            }
            
            // Unknown error - remove from pending and reject
            this.pendingSpins.delete(requestId);
            throw error;
        }
    }
    
    /**
     * Execute request with timeout
     */
    async executeWithTimeout(requestFn, timeoutMs) {
        return Promise.race([
            requestFn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs)
            )
        ]);
    }
    
    /**
     * Handle network errors (connection lost)
     */
    async handleNetworkError(request, error) {
        console.warn('📡 Network error detected, attempting recovery...');
        
        // Show reconnecting state
        this.showReconnectingOverlay();
        
        // Attempt to recover
        for (let attempt = 0; attempt < this.maxReconnectAttempts; attempt++) {
            this.reconnectAttempts = attempt + 1;
            
            try {
                // Check if result is available on server (request may have succeeded)
                const pendingResult = await this.checkPendingResult(request.requestId);
                if (pendingResult) {
                    console.log('✅ Recovered pending spin result from server');
                    this.hideReconnectingOverlay();
                    this.pendingSpins.delete(request.requestId);
                    return pendingResult;
                }
                
                // Wait with exponential backoff
                const backoffMs = this.calculateBackoff(attempt);
                this.updateReconnectingOverlay(`Reconnecting... (${attempt + 1}/${this.maxReconnectAttempts})`);
                await this.delay(backoffMs);
                
                // Retry request
                const retryResult = await this.networkService.processSpin(request);
                
                // Success!
                console.log('✅ Request succeeded on retry', attempt + 1);
                this.hideReconnectingOverlay();
                this.pendingSpins.delete(request.requestId);
                this.reconnectAttempts = 0;
                return retryResult;
                
            } catch (retryError) {
                console.warn(`Retry attempt ${attempt + 1} failed:`, retryError.message);
                // Continue to next retry
            }
        }
        
        // All retries failed
        this.hideReconnectingOverlay();
        this.showConnectionFailedError();
        this.pendingSpins.delete(request.requestId);
        
        throw new Error('Unable to recover from network error after ' + this.maxReconnectAttempts + ' attempts');
    }
    
    /**
     * Handle server errors (5xx)
     */
    async handleServerError(request, error) {
        console.warn('🔧 Server error detected:', error.message);
        
        const pendingData = this.pendingSpins.get(request.requestId);
        if (!pendingData) {
            throw error;
        }
        
        pendingData.attempts++;
        
        // Retry server errors up to max attempts
        if (pendingData.attempts < this.config.maxRetryAttempts) {
            await this.delay(this.config.retryDelayMs * pendingData.attempts);
            
            try {
                const retryResult = await this.networkService.processSpin(request);
                this.pendingSpins.delete(request.requestId);
                return retryResult;
            } catch (retryError) {
                // Retry failed, check if we should try again
                if (pendingData.attempts < this.config.maxRetryAttempts) {
                    return this.handleServerError(request, retryError);
                }
            }
        }
        
        // Max retries exceeded
        this.pendingSpins.delete(request.requestId);
        this.showServerErrorOverlay(error);
        throw error;
    }
    
    /**
     * Handle timeout errors
     */
    async handleTimeoutError(request, error) {
        console.warn('⏱️ Request timeout, checking for pending result...');
        
        // Request may have succeeded on server despite timeout
        try {
            const pendingResult = await this.checkPendingResult(request.requestId);
            if (pendingResult) {
                console.log('✅ Found result on server after timeout');
                this.pendingSpins.delete(request.requestId);
                return pendingResult;
            }
        } catch (checkError) {
            console.warn('Could not check pending result:', checkError.message);
        }
        
        // No result available, retry the request
        const pendingData = this.pendingSpins.get(request.requestId);
        if (pendingData && pendingData.attempts < this.config.maxRetryAttempts) {
            pendingData.attempts++;
            await this.delay(this.config.retryDelayMs);
            
            try {
                const retryResult = await this.executeWithTimeout(
                    () => this.networkService.processSpin(request),
                    this.config.requestTimeout
                );
                this.pendingSpins.delete(request.requestId);
                return retryResult;
            } catch (retryError) {
                return this.handleTimeoutError(request, retryError);
            }
        }
        
        this.pendingSpins.delete(request.requestId);
        throw new Error('Request timeout - unable to complete spin');
    }
    
    /**
     * Check if spin result is available on server
     */
    async checkPendingResult(requestId) {
        if (!requestId) return null;
        
        try {
            const result = await this.networkService.getPendingSpinResult(requestId);
            if (result && result.success) {
                return result;
            }
            return null;
        } catch (error) {
            console.warn('Failed to check pending result:', error.message);
            return null;
        }
    }
    
    /**
     * Queue request for offline execution
     */
    async queueOfflineRequest(request) {
        console.log('📴 Offline - queueing request');
        
        if (this.offlineQueue.length >= this.config.maxOfflineQueue) {
            throw new Error('Offline queue full - please reconnect');
        }
        
        this.offlineQueue.push(request);
        this.showOfflineOverlay();
        
        // Listen for online event
        const onlineHandler = async () => {
            window.removeEventListener('online', onlineHandler);
            await this.processOfflineQueue();
        };
        window.addEventListener('online', onlineHandler);
        
        return {
            success: false,
            error: 'OFFLINE',
            message: 'Request queued for when connection is restored',
            queued: true
        };
    }
    
    /**
     * Process queued offline requests
     */
    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        console.log(`📡 Processing ${this.offlineQueue.length} queued requests...`);
        this.hideOfflineOverlay();
        
        const results = [];
        
        while (this.offlineQueue.length > 0) {
            const request = this.offlineQueue.shift();
            
            try {
                const result = await this.handleSpinRequest(request);
                results.push(result);
            } catch (error) {
                console.error('Failed to process queued request:', error);
                results.push({
                    success: false,
                    error: error.message,
                    requestId: request.requestId
                });
            }
        }
        
        return results;
    }
    
    /**
     * Error detection helpers
     */
    isNetworkError(error) {
        const networkErrors = ['NETWORK_ERROR', 'ERR_NETWORK', 'ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_RESET'];
        return networkErrors.some(code => error.message?.includes(code)) || 
               error.code === 'ERR_NETWORK' ||
               !navigator.onLine;
    }
    
    isServerError(error) {
        return error.response?.status >= 500 && error.response?.status < 600;
    }
    
    isTimeoutError(error) {
        return error.message?.includes('TIMEOUT') || 
               error.code === 'ECONNABORTED' ||
               error.message === 'REQUEST_TIMEOUT';
    }
    
    /**
     * UI overlay methods
     */
    showReconnectingOverlay() {
        if (this.reconnectingOverlay) return;
        
        this.reconnectingOverlay = this.createOverlay({
            id: 'network-reconnecting-overlay',
            message: 'Reconnecting to server...',
            spinner: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
        });
    }
    
    updateReconnectingOverlay(message) {
        if (!this.reconnectingOverlay) return;
        
        const messageEl = this.reconnectingOverlay.querySelector('.overlay-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
    
    hideReconnectingOverlay() {
        if (this.reconnectingOverlay) {
            this.reconnectingOverlay.remove();
            this.reconnectingOverlay = null;
        }
    }
    
    showConnectionFailedError() {
        this.errorOverlay = this.createOverlay({
            id: 'network-error-overlay',
            message: 'Connection lost. Unable to reach game server.',
            subMessage: 'Please check your internet connection and try again.',
            buttons: [
                {
                    text: 'Retry',
                    onClick: () => this.retryConnection()
                },
                {
                    text: 'Play Demo Mode',
                    onClick: () => this.switchToDemoMode()
                }
            ],
            backgroundColor: 'rgba(139, 0, 0, 0.9)'
        });
    }
    
    showServerErrorOverlay(error) {
        this.errorOverlay = this.createOverlay({
            id: 'server-error-overlay',
            message: 'Server Error',
            subMessage: error.message || 'The game server encountered an error. Please try again.',
            buttons: [
                {
                    text: 'Retry',
                    onClick: () => this.hideErrorOverlay()
                }
            ],
            backgroundColor: 'rgba(139, 69, 0, 0.9)'
        });
    }
    
    showOfflineOverlay() {
        if (this.reconnectingOverlay) return;
        
        this.reconnectingOverlay = this.createOverlay({
            id: 'network-offline-overlay',
            message: 'You are offline',
            subMessage: 'Requests will be queued and processed when connection is restored.',
            backgroundColor: 'rgba(105, 105, 105, 0.9)'
        });
    }
    
    hideOfflineOverlay() {
        this.hideReconnectingOverlay();
    }
    
    hideErrorOverlay() {
        if (this.errorOverlay) {
            this.errorOverlay.remove();
            this.errorOverlay = null;
        }
    }
    
    createOverlay(options) {
        const overlay = document.createElement('div');
        overlay.id = options.id;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${options.backgroundColor || 'rgba(0, 0, 0, 0.9)'};
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        // Message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'overlay-message';
        messageDiv.textContent = options.message;
        messageDiv.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
        `;
        overlay.appendChild(messageDiv);
        
        // Spinner
        if (options.spinner) {
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            spinner.style.cssText = `
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 20px 0;
            `;
            overlay.appendChild(spinner);
            
            // Add spinner animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Sub-message
        if (options.subMessage) {
            const subMessageDiv = document.createElement('div');
            subMessageDiv.textContent = options.subMessage;
            subMessageDiv.style.cssText = `
                font-size: 16px;
                margin-top: 10px;
                text-align: center;
                max-width: 80%;
            `;
            overlay.appendChild(subMessageDiv);
        }
        
        // Buttons
        if (options.buttons) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                margin-top: 30px;
                display: flex;
                gap: 20px;
            `;
            
            options.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.onclick = btn.onClick;
                button.style.cssText = `
                    padding: 12px 24px;
                    font-size: 16px;
                    font-weight: bold;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.3s;
                `;
                button.onmouseover = () => button.style.background = '#45a049';
                button.onmouseout = () => button.style.background = '#4CAF50';
                buttonContainer.appendChild(button);
            });
            
            overlay.appendChild(buttonContainer);
        }
        
        document.body.appendChild(overlay);
        return overlay;
    }
    
    /**
     * Recovery actions
     */
    async retryConnection() {
        this.hideErrorOverlay();
        this.reconnectAttempts = 0;
        
        // Try to reconnect
        this.showReconnectingOverlay();
        
        try {
            const healthCheck = await this.networkService.checkServerHealth();
            if (healthCheck) {
                console.log('✅ Server connection restored');
                this.hideReconnectingOverlay();
                
                // Process any offline queue
                await this.processOfflineQueue();
            } else {
                throw new Error('Server health check failed');
            }
        } catch (error) {
            console.error('Retry connection failed:', error);
            this.hideReconnectingOverlay();
            this.showConnectionFailedError();
        }
    }
    
    switchToDemoMode() {
        this.hideErrorOverlay();
        
        if (this.gameScene && typeof this.gameScene.switchToDemoMode === 'function') {
            this.gameScene.switchToDemoMode();
        } else {
            console.warn('Demo mode not available');
        }
    }
    
    /**
     * Utility methods
     */
    calculateBackoff(attempt) {
        return Math.min(
            this.reconnectBackoffBase * Math.pow(2, attempt),
            30000 // Max 30 seconds
        );
    }
    
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Public API
     */
    getPendingSpins() {
        return Array.from(this.pendingSpins.values());
    }
    
    getOfflineQueue() {
        return [...this.offlineQueue];
    }
    
    getRecoveryStats() {
        return {
            reconnectAttempts: this.reconnectAttempts,
            pendingSpinsCount: this.pendingSpins.size,
            offlineQueueSize: this.offlineQueue.length,
            isReconnecting: this.isReconnecting,
            lastSuccessfulRequest: this.lastSuccessfulRequest,
            recoveryMode: this.recoveryMode
        };
    }
    
    destroy() {
        // Clear all pending requests
        this.pendingSpins.clear();
        this.offlineQueue = [];
        
        // Remove overlays
        this.hideReconnectingOverlay();
        this.hideErrorOverlay();
        
        console.log('🔄 NetworkErrorRecovery destroyed');
    }
};
