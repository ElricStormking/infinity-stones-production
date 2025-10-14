// SpritePool.js - Object pooling for sprite reuse and performance optimization

window.SpritePool = class SpritePool {
    constructor(config = {}) {
        this.createFn = config.create || (() => null);
        this.resetFn = config.reset || ((obj) => obj);
        this.onReleaseFn = config.onRelease || (() => {});
        
        this.pool = [];
        this.activeObjects = new Set();
        
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            reused: 0,
            destroyed: 0,
            poolMisses: 0,
            poolHits: 0
        };
        
        this.config = {
            maxPoolSize: config.maxPoolSize || 100,
            initialSize: config.initialSize || 0,
            pruneThreshold: config.pruneThreshold || 200,
            enableStats: config.enableStats !== false
        };
        
        // Pre-populate pool if initial size specified
        if (this.config.initialSize > 0) {
            this.preallocate(this.config.initialSize);
        }
        
        console.log('♻️ SpritePool initialized:', {
            maxSize: this.config.maxPoolSize,
            initialSize: this.config.initialSize
        });
    }
    
    /**
     * Preallocate objects in the pool
     */
    preallocate(count) {
        for (let i = 0; i < count; i++) {
            const obj = this.createFn({});
            if (obj) {
                this.pool.push(obj);
                this.stats.created++;
            }
        }
        console.log(`♻️ Preallocated ${count} objects`);
    }
    
    /**
     * Acquire an object from the pool
     */
    acquire(options = {}) {
        let obj;
        
        // Try to get from pool
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this.resetFn(obj, options);
            this.stats.poolHits++;
            this.stats.reused++;
        } else {
            // Pool empty - create new object
            obj = this.createFn(options);
            this.stats.created++;
            this.stats.poolMisses++;
        }
        
        if (obj) {
            this.activeObjects.add(obj);
            this.stats.acquired++;
        }
        
        return obj;
    }
    
    /**
     * Release an object back to the pool
     */
    release(obj) {
        if (!obj) return;
        
        // Remove from active objects
        if (!this.activeObjects.has(obj)) {
            console.warn('♻️ Attempting to release object not in active set');
            return;
        }
        
        this.activeObjects.delete(obj);
        this.stats.released++;
        
        // Run release cleanup
        try {
            this.onReleaseFn(obj);
        } catch (error) {
            console.error('♻️ Error during object release:', error);
        }
        
        // Add back to pool if not full
        if (this.pool.length < this.config.maxPoolSize) {
            this.pool.push(obj);
        } else {
            // Pool full - destroy object
            this.destroyObject(obj);
            this.stats.destroyed++;
        }
        
        // Prune pool if it's too large
        if (this.pool.length > this.config.pruneThreshold) {
            this.prune();
        }
    }
    
    /**
     * Release multiple objects at once
     */
    releaseAll(objects) {
        if (!Array.isArray(objects)) return;
        
        objects.forEach(obj => this.release(obj));
    }
    
    /**
     * Prune excess objects from pool
     */
    prune(targetSize = null) {
        const target = targetSize || this.config.maxPoolSize;
        
        while (this.pool.length > target) {
            const obj = this.pool.pop();
            this.destroyObject(obj);
            this.stats.destroyed++;
        }
        
        if (this.config.enableStats) {
            console.log(`♻️ Pruned pool to ${this.pool.length} objects`);
        }
    }
    
    /**
     * Destroy an object
     */
    destroyObject(obj) {
        if (!obj) return;
        
        try {
            if (typeof obj.destroy === 'function') {
                obj.destroy();
            }
        } catch (error) {
            console.error('♻️ Error destroying object:', error);
        }
    }
    
    /**
     * Clear the entire pool
     */
    clear() {
        // Destroy all pooled objects
        while (this.pool.length > 0) {
            const obj = this.pool.pop();
            this.destroyObject(obj);
        }
        
        // Clear active objects (but don't destroy - they're still in use)
        this.activeObjects.clear();
        
        console.log('♻️ SpritePool cleared');
    }
    
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            ...this.stats,
            poolSize: this.pool.length,
            activeCount: this.activeObjects.size,
            totalObjects: this.pool.length + this.activeObjects.size,
            hitRate: this.stats.acquired > 0 
                ? ((this.stats.poolHits / this.stats.acquired) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Get pool status
     */
    getStatus() {
        return {
            available: this.pool.length,
            active: this.activeObjects.size,
            maxSize: this.config.maxPoolSize,
            utilizationPercent: ((this.activeObjects.size / this.config.maxPoolSize) * 100).toFixed(1)
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            reused: 0,
            destroyed: 0,
            poolMisses: 0,
            poolHits: 0
        };
    }
};
