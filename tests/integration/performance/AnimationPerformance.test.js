describe('FrameMonitor performance tracking', () => {
    beforeEach(() => {
        jest.resetModules();
        global.window = {};
        require('../../../src/performance/FrameMonitor.js');
    });

    test('shouldReduceQuality triggers when drop rate threshold exceeded', () => {
        const monitor = new window.FrameMonitor();

        for (let i = 0; i < 100; i++) {
            monitor.recordFrame(16, i * 17);
        }

        for (let i = 0; i < 10; i++) {
            monitor.recordFrame(40, 2000 + i * 40);
        }

        expect(monitor.shouldReduceQuality(0.05)).toBe(true);
    });

    test('getFPS reports approximate frame rate', () => {
        const monitor = new window.FrameMonitor();

        for (let i = 0; i < 60; i++) {
            monitor.recordFrame(16.67, i * 16.67);
        }

        const fps = monitor.getFPS();
        expect(fps).toBeGreaterThanOrEqual(55);
        expect(fps).toBeLessThanOrEqual(65);
    });
});