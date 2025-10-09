// FrameMonitor - lightweight FPS/drop tracker for cascade sequences

window.FrameMonitor = class FrameMonitor {
    constructor() {
        this.monitoringActive = false;
        this.lastStamp = 0;
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.dropThresholdMs = 24; // frames slower than ~41 FPS count as drops
        this.dropRateThreshold = 0.05;
        this.sampleWindowMs = 2000;
        this.samples = [];
    }

    start() {
        if (this.monitoringActive) {
            return;
        }
        this.monitoringActive = true;
        this.reset();
        this.lastStamp = performance.now();
        this._tick();
    }

    startMonitoring() {
        this.start();
    }

    stop() {
        this.monitoringActive = false;
    }

    stopMonitoring() {
        this.stop();
    }

    reset() {
        this.samples = [];
        this.totalFrames = 0;
        this.droppedFrames = 0;
    }

    _tick() {
        if (!this.monitoringActive) {
            return;
        }

        requestAnimationFrame((now) => {
            const dt = now - (this.lastStamp || now);
            this.lastStamp = now;
            this.recordFrame(dt, now);
            this._tick();
        });
    }

    recordFrame(frameTime, timestamp) {
        this.totalFrames++;
        if (frameTime > this.dropThresholdMs) {
            this.droppedFrames++;
        }

        const sample = {
            dt: frameTime,
            timestamp: timestamp || performance.now()
        };
        this.samples.push(sample);

        const cutoff = sample.timestamp - this.sampleWindowMs;
        this.samples = this.samples.filter((entry) => entry.timestamp >= cutoff);
    }

    getFPS() {
        if (this.samples.length === 0) {
            return 0;
        }
        const totalDt = this.samples.reduce((sum, entry) => sum + entry.dt, 0);
        const avgDt = totalDt / this.samples.length || 16.67;
        return Math.round(1000 / avgDt);
    }

    getDropRate() {
        if (this.totalFrames === 0) {
            return 0;
        }
        return this.droppedFrames / this.totalFrames;
    }

    shouldReduceQuality(threshold = this.dropRateThreshold) {
        return this.getDropRate() > threshold;
    }
};