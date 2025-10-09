const GameEngine = require('../src/game/gameEngine');

describe('Server cascade structure', () => {
  const engine = new GameEngine();

  test('processCompleteSpin returns canonical cascadeSteps', async () => {
    const res = await engine.processCompleteSpin({ betAmount: 1.0, playerId: 't', sessionId: 's' });
    expect(res).toHaveProperty('cascadeSteps');
    expect(Array.isArray(res.cascadeSteps)).toBe(true);
    // Validate step fields when present
    if (res.cascadeSteps.length > 0) {
      const step = res.cascadeSteps[0];
      expect(step).toHaveProperty('stepNumber');
      expect(step).toHaveProperty('gridStateBefore');
      expect(step).toHaveProperty('gridStateAfter');
      expect(step).toHaveProperty('matchedClusters');
      expect(step).toHaveProperty('cascadeWin');
    }
  });
});



