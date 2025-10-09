const GameEngine = require('../src/game/gameEngine');

describe('GameEngine Cascade Timing', () => {
  test('cascadeSteps contain timing with sane totals', async () => {
    const gameEngine = new GameEngine();
    const spinRequest = {
      betAmount: 1.00,
      playerId: 'test-player',
      sessionId: 'test-session',
      freeSpinsActive: false,
      accumulatedMultiplier: 1,
      quickSpinMode: false
    };

    const spinResult = await gameEngine.processCompleteSpin(spinRequest);

    expect(spinResult).toHaveProperty('cascadeSteps');
    expect(Array.isArray(spinResult.cascadeSteps)).toBe(true);

    let accumulated = 0;
    for (const step of spinResult.cascadeSteps) {
      expect(step).toHaveProperty('timing');
      const t = step.timing || {};
      // required fields present
      expect(typeof t.totalDuration).toBe('number');
      expect(t.totalDuration).toBeGreaterThanOrEqual(100);
      // sanity bounds (not seconds-long)
      expect(t.totalDuration).toBeLessThanOrEqual(5000);

      // phases shape sanity if present
      if (t.phases) {
        expect(typeof t.phases.symbolRemoval?.duration).toBe('number');
        expect(typeof t.phases.symbolDrop?.duration).toBe('number');
      }

      accumulated += t.totalDuration || 0;
    }

    // spin timing aggregates include cascade duration
    expect(spinResult.timing).toBeTruthy();
    expect(spinResult.timing.cascadeDuration).toBeGreaterThanOrEqual(accumulated * 0.8);
    expect(spinResult.timing.cascadeDuration).toBeLessThanOrEqual(accumulated * 1.2);
  });
});



