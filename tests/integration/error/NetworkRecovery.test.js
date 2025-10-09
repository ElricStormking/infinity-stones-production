const setupRecovery = () => {
    global.window = global.window || {};
    require('../../../src/network/ErrorRecovery.js');
    return window.NetworkErrorRecovery;
};

describe('NetworkErrorRecovery', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('recovers after a transient network failure', async () => {
        const NetworkErrorRecovery = setupRecovery();
        const notifications = jest.fn();
        const gameAPI = {
            notifyNetworkStatus: notifications,
            fetchPendingResult: jest.fn(() => null)
        };

        const recovery = new NetworkErrorRecovery(gameAPI);
        recovery.wait = jest.fn(() => Promise.resolve());

        const networkError = new Error('connection reset');
        networkError.code = 'ECONNRESET';

        const executor = jest.fn()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce({ success: true });

        const result = await recovery.handleSpinRequest({ betAmount: 10 }, executor);

        expect(result).toEqual({ success: true });
        expect(executor).toHaveBeenCalledTimes(2);
        expect(notifications).toHaveBeenCalledWith('reconnecting', expect.any(Object));
        expect(notifications).toHaveBeenCalledWith('retry', expect.any(Object));
        expect(notifications).toHaveBeenCalledWith('recovered', expect.any(Object));
    });

    test('fails after exceeding maximum attempts', async () => {
        const NetworkErrorRecovery = setupRecovery();
        const notifications = jest.fn();
        const gameAPI = {
            notifyNetworkStatus: notifications,
            fetchPendingResult: jest.fn(() => null)
        };

        const recovery = new NetworkErrorRecovery(gameAPI);
        recovery.maxReconnectAttempts = 2;
        recovery.wait = jest.fn(() => Promise.resolve());

        const timeoutError = new Error('timeout');
        timeoutError.code = 'ETIMEDOUT';
        const executor = jest.fn().mockRejectedValue(timeoutError);

        await expect(
            recovery.handleSpinRequest({ betAmount: 20 }, executor)
        ).rejects.toThrow('Unable to recover from network error');

        expect(executor).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
        expect(notifications).toHaveBeenCalledWith('failed', expect.any(Object));
    });
});
    test('manual retry recovers pending result from cache', async () => {
        const NetworkErrorRecovery = setupRecovery();
        const notifications = jest.fn();
        const pendingResponse = { success: true, data: { cascadeSteps: [], initialGrid: [], finalGrid: [] } };
        const fetchPendingResult = jest.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValue(pendingResponse);
        const gameAPI = {
            notifyNetworkStatus: notifications,
            fetchPendingResult
        };

        const recovery = new NetworkErrorRecovery(gameAPI);
        recovery.maxReconnectAttempts = 1;
        recovery.wait = jest.fn(() => Promise.resolve());

        const transientError = new Error('offline');
        transientError.code = 'ECONNRESET';

        const executor = jest.fn().mockRejectedValue(transientError);

        await expect(recovery.handleSpinRequest({ betAmount: 5 }, executor))
            .rejects.toThrow('Unable to recover from network error');

        const outcomes = await recovery.retryPendingRequests();
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].status).toBe('recovered');
        expect(fetchPendingResult).toHaveBeenCalledWith(expect.stringMatching(/^spin-/));
        expect(fetchPendingResult).toHaveBeenCalledTimes(2);
        expect(notifications).toHaveBeenCalledWith('manual-retry', expect.any(Object));
        expect(recovery.pendingSpins.size).toBe(0);
    });

