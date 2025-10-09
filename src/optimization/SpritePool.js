// SpritePool - simple object pool for Phaser sprites and symbol instances

window.SpritePool = class SpritePool {
    constructor(options = {}) {
        this.pool = [];
        this.create = options.create || null;
        this.reset = options.reset || null;
        this.onRelease = options.onRelease || null;
    }

    acquire(args = null) {
        let sprite = this.pool.pop();
        if (!sprite) {
            if (typeof this.create !== 'function') {
                throw new Error('SpritePool requires a create function for new entries');
            }
            sprite = this.create(args);
        } else if (typeof this.reset === 'function') {
            this.reset(sprite, args);
        }
        return sprite;
    }

    release(sprite) {
        if (!sprite) {
            return;
        }

        try {
            if (typeof this.onRelease === 'function') {
                this.onRelease(sprite);
            } else {
                if (typeof sprite.setVisible === 'function') sprite.setVisible(false);
                if (typeof sprite.setActive === 'function') sprite.setActive(false);
                if (sprite.body && typeof sprite.body.enable !== 'undefined') {
                    sprite.body.enable = false;
                }
            }
        } catch (error) {
            console.warn('SpritePool release cleanup failed:', error);
        }

        this.pool.push(sprite);
    }

    clear() {
        this.pool.length = 0;
    }

    size() {
        return this.pool.length;
    }

    warm(count, argsProvider = null) {
        if (typeof this.create !== 'function') {
            return;
        }
        for (let i = 0; i < count; i++) {
            const args = typeof argsProvider === 'function' ? argsProvider(i) : argsProvider;
            const sprite = this.create(args);
            this.release(sprite);
        }
    }
};