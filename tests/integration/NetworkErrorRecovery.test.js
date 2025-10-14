// NetworkErrorRecovery.test.js - Integration tests for error recovery system

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Network Error Recovery Integration', () => {
    let errorRecovery;
    let mockNetworkService;
    let mockGameScene;
    
    beforeEach(() => {
        // Mock NetworkService
        mockNetworkService = {
            processSpin: jest.fn(),
            getPendingSpinResult: jest.fn(),
            checkServerHealth: jest.fn()
        };
        
        // Mock GameScene
        mockGameScene = {
            switchToDemoMode: jest.fn()
        };
        
        // Create ErrorRecovery instance
        const NetworkErrorRecovery = require('../../src/network/ErrorRecovery').NetworkErrorRecovery;
        errorRecovery = new NetworkErrorRecovery(mockNetworkService, mockGameScene);
    });
    
    afterEach(() => {
        errorRecovery.destroy();
    });
    
    describe('handleSpinRequest', () => {
        test('successful spin request completes normally', async () => {
            const mockResult = {
                success: true,
                data: { spinId: 'test-123', totalWin: 10.50 }
            };
            
            mockNetworkService.processSpin.mockResolvedValue(mockResult);
            
            const result = await errorRecovery.handleSpinRequest({
                betAmount: 1.00
            });
            
            expect(result).toEqual(mockResult);
            expect(errorRecovery.pendingSpins.size).toBe(0);
            expect(errorRecovery.reconnectAttempts).toBe(0);
        });
        
        test('network error triggers retry with exponential backoff', async () => {
            const networkError = new Error('NETWORK_ERROR');
            const successResult = { success: true, data: { spinId: 'test-456' } };
            
            mockNetworkService.processSpin
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(successResult);
            
            mockNetworkService.getPendingSpinResult.mockResolvedValue(null);
            
            const result = await errorRecovery.handleSpinRequest({
                betAmount: 1.00
            });
            
            expect(result).toEqual(successResult);
            expect(mockNetworkService.processSpin).toHaveBeenCalledTimes(3);
            expect(errorRecovery.pendingSpins.size).toBe(0);
        });
        
        test('pending result recovery after network error', async () => {
            const networkError = new Error('NETWORK_ERROR');
            const pendingResult = { success: true, data: { spinId: 'pending-789' } };
            
            mockNetworkService.processSpin.mockRejectedValue(networkError);
            mockNetworkService.getPendingSpinResult.mockResolvedValueOnce(pendingResult);
            
            const result = await errorRecovery.handleSpinRequest({
                betAmount: 1.00
            });
            
            expect(result).toEqual(pendingResult);
            expect(mockNetworkService.getPendingSpinResult).toHaveBeenCalled();
            expect(errorRecovery.pendingSpins.size).toBe(0);
        });
        
        test('timeout error triggers retry', async () => {
            const timeoutError = new Error('REQUEST_TIMEOUT');
            const successResult = { success: true, data: { spinId: 'timeout-123' } };
            
            mockNetworkService.processSpin
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValueOnce(successResult);
            
            mockNetworkService.getPendingSpinResult.mockResolvedValue(null);
            
            const result = await errorRecovery.handleSpinRequest({
                betAmount: 1.00
            });
            
            expect(result).toEqual(successResult);
            expect(mockNetworkService.processSpin).toHaveBeenCalledTimes(2);
        });
        
        test('server error (5xx) triggers limited retries', async () => {
            const serverError = new Error('Server Error');
            serverError.response = { status: 503 };
            
            mockNetworkService.processSpin.mockRejectedValue(serverError);
            
            await expect(
                errorRecovery.handleSpinRequest({ betAmount: 1.00 })
            ).rejects.toThrow();
            
            expect(mockNetworkService.processSpin).toHaveBeenCalledTimes(
                errorRecovery.config.maxRetryAttempts
            );
        });
        
        test('max retry attempts exhausted throws error', async () => {
            const networkError = new Error('NETWORK_ERROR');
            
            mockNetworkService.processSpin.mockRejectedValue(networkError);
            mockNetworkService.getPendingSpinResult.mockResolvedValue(null);
            
            await expect(
                errorRecovery.handleSpinRequest({ betAmount: 1.00 })
            ).rejects.toThrow(/Unable to recover from network error/);
            
            expect(mockNetworkService.processSpin).toHaveBeenCalled();
        });
    });
    
    describe('offline queue', () => {
        test('offline requests are queued', async () => {
            // Simulate offline
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false
            });
            
            const result = await errorRecovery.handleSpinRequest({
                betAmount: 1.00
            });
            
            expect(result.queued).toBe(true);
            expect(errorRecovery.offlineQueue.length).toBe(1);
        });
        
        test('queued requests processed when online', async () => {
            // Start offline
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false
            });
            
            // Queue requests
            await errorRecovery.handleSpinRequest({ betAmount: 1.00 });
            await errorRecovery.handleSpinRequest({ betAmount: 2.00 });
            
            expect(errorRecovery.offlineQueue.length).toBe(2);
            
            // Go online
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: true
            });
            
            const successResult = { success: true, data: {} };
            mockNetworkService.processSpin.mockResolvedValue(successResult);
            
            // Process queue
            const results = await errorRecovery.processOfflineQueue();
            
            expect(results.length).toBe(2);
            expect(errorRecovery.offlineQueue.length).toBe(0);
        });
        
        test('offline queue respects max size', async () => {
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false
            });
            
            // Fill queue to max
            for (let i = 0; i < errorRecovery.config.maxOfflineQueue; i++) {
                await errorRecovery.handleSpinRequest({ betAmount: 1.00 });
            }
            
            // Try to add one more
            await expect(
                errorRecovery.handleSpinRequest({ betAmount: 1.00 })
            ).rejects.toThrow(/Offline queue full/);
        });
    });
    
    describe('error detection', () => {
        test('identifies network errors correctly', () => {
            const networkError1 = new Error('NETWORK_ERROR occurred');
            const networkError2 = new Error('ERR_CONNECTION_REFUSED');
            const networkError3 = { code: 'ERR_NETWORK' };
            
            expect(errorRecovery.isNetworkError(networkError1)).toBe(true);
            expect(errorRecovery.isNetworkError(networkError2)).toBe(true);
            expect(errorRecovery.isNetworkError(networkError3)).toBe(true);
        });
        
        test('identifies server errors correctly', () => {
            const serverError1 = { response: { status: 500 } };
            const serverError2 = { response: { status: 503 } };
            const notServerError = { response: { status: 400 } };
            
            expect(errorRecovery.isServerError(serverError1)).toBe(true);
            expect(errorRecovery.isServerError(serverError2)).toBe(true);
            expect(errorRecovery.isServerError(notServerError)).toBe(false);
        });
        
        test('identifies timeout errors correctly', () => {
            const timeoutError1 = new Error('REQUEST_TIMEOUT');
            const timeoutError2 = { code: 'ECONNABORTED' };
            const notTimeoutError = new Error('OTHER_ERROR');
            
            expect(errorRecovery.isTimeoutError(timeoutError1)).toBe(true);
            expect(errorRecovery.isTimeoutError(timeoutError2)).toBe(true);
            expect(errorRecovery.isTimeoutError(notTimeoutError)).toBe(false);
        });
    });
    
    describe('exponential backoff', () => {
        test('calculates correct backoff times', () => {
            expect(errorRecovery.calculateBackoff(0)).toBe(1000); // 1s
            expect(errorRecovery.calculateBackoff(1)).toBe(2000); // 2s
            expect(errorRecovery.calculateBackoff(2)).toBe(4000); // 4s
            expect(errorRecovery.calculateBackoff(3)).toBe(8000); // 8s
            expect(errorRecovery.calculateBackoff(10)).toBe(30000); // Max 30s
        });
    });
    
    describe('recovery stats', () => {
        test('tracks recovery statistics', async () => {
            const mockResult = { success: true, data: {} };
            mockNetworkService.processSpin.mockResolvedValue(mockResult);
            
            await errorRecovery.handleSpinRequest({ betAmount: 1.00 });
            
            const stats = errorRecovery.getRecoveryStats();
            
            expect(stats).toHaveProperty('reconnectAttempts');
            expect(stats).toHaveProperty('pendingSpinsCount');
            expect(stats).toHaveProperty('offlineQueueSize');
            expect(stats).toHaveProperty('lastSuccessfulRequest');
        });
    });
    
    describe('connection retry', () => {
        test('retry connection checks server health', async () => {
            mockNetworkService.checkServerHealth.mockResolvedValue(true);
            
            await errorRecovery.retryConnection();
            
            expect(mockNetworkService.checkServerHealth).toHaveBeenCalled();
            expect(errorRecovery.reconnectAttempts).toBe(0);
        });
        
        test('failed retry shows error overlay', async () => {
            mockNetworkService.checkServerHealth.mockRejectedValue(
                new Error('Health check failed')
            );
            
            await errorRecovery.retryConnection();
            
            expect(errorRecovery.errorOverlay).toBeTruthy();
        });
    });
});

describe('Network Error Recovery - End-to-End', () => {
    test('complete error recovery flow', async () => {
        const mockNetworkService = {
            processSpin: jest.fn(),
            getPendingSpinResult: jest.fn(),
            checkServerHealth: jest.fn()
        };
        
        const NetworkErrorRecovery = require('../../src/network/ErrorRecovery').NetworkErrorRecovery;
        const recovery = new NetworkErrorRecovery(mockNetworkService, null);
        
        // Simulate: Network fails once, then succeeds
        const networkError = new Error('NETWORK_ERROR');
        const successResult = { success: true, data: { spinId: 'e2e-123', totalWin: 25.00 } };
        
        mockNetworkService.processSpin
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce(successResult);
        
        mockNetworkService.getPendingSpinResult.mockResolvedValue(null);
        
        const startTime = Date.now();
        const result = await recovery.handleSpinRequest({ betAmount: 1.00 });
        const endTime = Date.now();
        
        // Should succeed after retry
        expect(result).toEqual(successResult);
        
        // Should have taken some time (backoff delay)
        expect(endTime - startTime).toBeGreaterThan(500);
        
        // Should have cleared pending spins
        expect(recovery.getPendingSpins().length).toBe(0);
        
        recovery.destroy();
    });
});

module.exports = {
    // Export for integration with other tests
};

