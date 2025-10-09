// CascadeAnimator - Promise-based animation queue to prevent race conditions

window.CascadeAnimator = class CascadeAnimator {
    constructor() {
        this._chain = Promise.resolve();
        this._active = 0;
    }

    // Queue an async animation function to run after prior animations
    queue(animationFn) {
        this._chain = this._chain.then(async () => {
            this._active++;
            try {
                await animationFn();
            } finally {
                this._active--;
            }
        });
        return this._chain;
    }

    // Wait for all queued animations to finish
    async flush() {
        await this._chain;
    }

    isAnimating() {
        return this._active > 0;
    }
};

