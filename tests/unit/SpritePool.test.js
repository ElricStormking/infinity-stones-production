// SpritePool.test.js - Unit tests for sprite pooling system

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

describe('SpritePool', () => {
    let SpritePool;
    let pool;
    let mockSprite;
    let createSpy;
    let resetSpy;
    let releaseSpy;
    
    beforeEach(() => {
        // Mock sprite class
        mockSprite = {
            destroy: jest.fn(),
            reset: jest.fn(),
            setVisible: jest.fn(),
            setActive: jest.fn()
        };
        
        // Mock factory functions
        createSpy = jest.fn(() => ({ ...mockSprite }));
        resetSpy = jest.fn((obj, options) => obj);
        releaseSpy = jest.fn();
        
        // Assuming SpritePool is available globally in browser environment
        // For Node.js testing, we'd need to require/import it
        SpritePool = require('../../src/optimization/SpritePool').SpritePool;
        
        pool = new SpritePool({
            create: createSpy,
            reset: resetSpy,
            onRelease: releaseSpy,
            maxPoolSize: 10,
            initialSize: 0
        });
    });
    
    describe('initialization', () => {
        test('creates pool with correct configuration', () => {
            expect(pool.config.maxPoolSize).toBe(10);
            expect(pool.pool.length).toBe(0);
            expect(pool.activeObjects.size).toBe(0);
        });
        
        test('preallocates objects when initialSize specified', () => {
            const prePool = new SpritePool({
                create: createSpy,
                initialSize: 5
            });
            
            expect(prePool.pool.length).toBe(5);
            expect(createSpy).toHaveBeenCalledTimes(5);
        });
    });
    
    describe('acquire', () => {
        test('creates new object when pool is empty', () => {
            const obj = pool.acquire();
            
            expect(createSpy).toHaveBeenCalledTimes(1);
            expect(pool.activeObjects.has(obj)).toBe(true);
            expect(pool.stats.created).toBe(1);
            expect(pool.stats.poolMisses).toBe(1);
        });
        
        test('reuses object from pool when available', () => {
            // First acquire creates new object
            const obj1 = pool.acquire();
            pool.release(obj1);
            
            // Second acquire should reuse from pool
            createSpy.mockClear();
            const obj2 = pool.acquire();
            
            expect(createSpy).not.toHaveBeenCalled();
            expect(resetSpy).toHaveBeenCalledWith(obj1, {});
            expect(pool.stats.reused).toBe(1);
            expect(pool.stats.poolHits).toBe(1);
        });
        
        test('passes options to reset function', () => {
            const obj = pool.acquire();
            pool.release(obj);
            
            const options = { type: 'gem', col: 2, row: 3 };
            pool.acquire(options);
            
            expect(resetSpy).toHaveBeenCalledWith(obj, options);
        });
        
        test('tracks acquired count', () => {
            pool.acquire();
            pool.acquire();
            pool.acquire();
            
            expect(pool.stats.acquired).toBe(3);
        });
    });
    
    describe('release', () => {
        test('returns object to pool', () => {
            const obj = pool.acquire();
            pool.release(obj);
            
            expect(pool.activeObjects.has(obj)).toBe(false);
            expect(pool.pool.length).toBe(1);
            expect(pool.stats.released).toBe(1);
        });
        
        test('calls onRelease callback', () => {
            const obj = pool.acquire();
            pool.release(obj);
            
            expect(releaseSpy).toHaveBeenCalledWith(obj);
        });
        
        test('destroys object when pool is full', () => {
            // Fill pool to max
            const objects = [];
            for (let i = 0; i < pool.config.maxPoolSize; i++) {
                objects.push(pool.acquire());
            }
            
            objects.forEach(obj => pool.release(obj));
            
            expect(pool.pool.length).toBe(pool.config.maxPoolSize);
            
            // Release one more - should be destroyed
            const extraObj = pool.acquire();
            pool.release(extraObj);
            
            expect(pool.pool.length).toBe(pool.config.maxPoolSize);
            expect(extraObj.destroy).toHaveBeenCalled();
            expect(pool.stats.destroyed).toBeGreaterThan(0);
        });
        
        test('warns when releasing inactive object', () => {
            const obj = { ...mockSprite };
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            pool.release(obj);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('not in active set')
            );
            
            consoleSpy.mockRestore();
        });
        
        test('handles null/undefined gracefully', () => {
            expect(() => pool.release(null)).not.toThrow();
            expect(() => pool.release(undefined)).not.toThrow();
        });
    });
    
    describe('releaseAll', () => {
        test('releases multiple objects', () => {
            const objects = [
                pool.acquire(),
                pool.acquire(),
                pool.acquire()
            ];
            
            pool.releaseAll(objects);
            
            expect(pool.activeObjects.size).toBe(0);
            expect(pool.pool.length).toBe(3);
        });
        
        test('handles empty array', () => {
            expect(() => pool.releaseAll([])).not.toThrow();
        });
        
        test('handles non-array gracefully', () => {
            expect(() => pool.releaseAll(null)).not.toThrow();
            expect(() => pool.releaseAll(undefined)).not.toThrow();
        });
    });
    
    describe('prune', () => {
        test('removes excess objects from pool', () => {
            // Add objects to pool
            for (let i = 0; i < 15; i++) {
                const obj = pool.acquire();
                pool.release(obj);
            }
            
            expect(pool.pool.length).toBe(10); // Max pool size
            
            pool.prune(5);
            
            expect(pool.pool.length).toBe(5);
        });
        
        test('destroys pruned objects', () => {
            const objects = [];
            for (let i = 0; i < 10; i++) {
                const obj = pool.acquire();
                objects.push(obj);
                pool.release(obj);
            }
            
            pool.prune(5);
            
            // Last 5 objects should be destroyed
            const destroyedCount = objects.filter(obj => obj.destroy.mock.calls.length > 0).length;
            expect(destroyedCount).toBeGreaterThan(0);
        });
        
        test('uses maxPoolSize as default target', () => {
            for (let i = 0; i < 20; i++) {
                const obj = pool.acquire();
                pool.release(obj);
            }
            
            pool.prune();
            
            expect(pool.pool.length).toBeLessThanOrEqual(pool.config.maxPoolSize);
        });
    });
    
    describe('clear', () => {
        test('destroys all pooled objects', () => {
            const objects = [];
            for (let i = 0; i < 5; i++) {
                const obj = pool.acquire();
                objects.push(obj);
                pool.release(obj);
            }
            
            pool.clear();
            
            expect(pool.pool.length).toBe(0);
            objects.forEach(obj => {
                expect(obj.destroy).toHaveBeenCalled();
            });
        });
        
        test('clears active objects set', () => {
            pool.acquire();
            pool.acquire();
            
            pool.clear();
            
            expect(pool.activeObjects.size).toBe(0);
        });
    });
    
    describe('statistics', () => {
        test('tracks pool statistics correctly', () => {
            // Create and release several objects
            const obj1 = pool.acquire(); // Created
            pool.release(obj1);
            
            const obj2 = pool.acquire(); // Reused
            pool.release(obj2);
            
            pool.acquire(); // Reused
            
            const stats = pool.getStats();
            
            expect(stats.created).toBe(1);
            expect(stats.acquired).toBe(3);
            expect(stats.released).toBe(2);
            expect(stats.reused).toBe(2);
            expect(stats.poolHits).toBe(2);
            expect(stats.poolMisses).toBe(1);
        });
        
        test('calculates hit rate correctly', () => {
            const obj = pool.acquire();
            pool.release(obj);
            
            pool.acquire(); // Hit
            pool.acquire(); // Miss (creates new)
            
            const stats = pool.getStats();
            
            expect(stats.hitRate).toBe('50.00%');
        });
        
        test('includes pool size in stats', () => {
            pool.acquire();
            const obj = pool.acquire();
            pool.release(obj);
            
            const stats = pool.getStats();
            
            expect(stats.poolSize).toBe(1);
            expect(stats.activeCount).toBe(1);
            expect(stats.totalObjects).toBe(2);
        });
    });
    
    describe('status', () => {
        test('returns current pool status', () => {
            pool.acquire();
            pool.acquire();
            const obj = pool.acquire();
            pool.release(obj);
            
            const status = pool.getStatus();
            
            expect(status.available).toBe(1);
            expect(status.active).toBe(2);
            expect(status.maxSize).toBe(10);
            expect(status.utilizationPercent).toBe('20.0');
        });
    });
    
    describe('resetStats', () => {
        test('resets all statistics to zero', () => {
            pool.acquire();
            pool.acquire();
            
            pool.resetStats();
            
            const stats = pool.getStats();
            expect(stats.created).toBe(0);
            expect(stats.acquired).toBe(0);
            expect(stats.released).toBe(0);
            expect(stats.poolHits).toBe(0);
            expect(stats.poolMisses).toBe(0);
        });
    });
    
    describe('performance', () => {
        test('handles large number of acquire/release cycles efficiently', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                const obj = pool.acquire();
                pool.release(obj);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete 1000 cycles in less than 100ms
            expect(duration).toBeLessThan(100);
            
            // Should have high reuse rate
            const stats = pool.getStats();
            expect(stats.reused).toBeGreaterThan(990);
        });
        
        test('pool prevents excessive memory allocation', () => {
            // Create many objects
            for (let i = 0; i < 100; i++) {
                const obj = pool.acquire();
                pool.release(obj);
            }
            
            const stats = pool.getStats();
            
            // Should have created far fewer objects than acquisitions
            expect(stats.created).toBeLessThan(20);
            expect(stats.acquired).toBe(100);
        });
    });
});

describe('SpritePool - Integration Scenarios', () => {
    test('handles cascade animation scenario', () => {
        const SpritePool = require('../../src/optimization/SpritePool').SpritePool;
        
        const symbolPool = new SpritePool({
            create: () => ({
                type: null,
                x: 0,
                y: 0,
                destroy: jest.fn(),
                setTexture: jest.fn()
            }),
            reset: (symbol, options) => {
                symbol.type = options.type;
                return symbol;
            },
            maxPoolSize: 30
        });
        
        // Simulate initial grid fill (30 symbols)
        const grid = [];
        for (let i = 0; i < 30; i++) {
            grid.push(symbolPool.acquire({ type: 'gem' }));
        }
        
        // Simulate cascade (remove 8 symbols, add 8 new ones)
        const removed = grid.splice(0, 8);
        removed.forEach(symbol => symbolPool.release(symbol));
        
        for (let i = 0; i < 8; i++) {
            grid.push(symbolPool.acquire({ type: 'power_gem' }));
        }
        
        const stats = symbolPool.getStats();
        
        // Should have reused symbols efficiently
        expect(stats.created).toBeLessThanOrEqual(30);
        expect(stats.reused).toBe(8);
        expect(symbolPool.activeObjects.size).toBe(30);
    });
});

module.exports = {};

