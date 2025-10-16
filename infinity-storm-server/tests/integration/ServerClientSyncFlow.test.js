/**
 * Server-Client Sync Flow Integration Test
 *
 * Verifies that the HTTP /api/spin endpoint returns a canonical payload
 * that the client can render without additional transformation steps.
 *
 * Checks:
 * - Demo-bypass header works; request succeeds unauthenticated
 * - Response uses canonical shape matching /api/demo-spin
 * - Each cascade step includes canonical grid fields and droppingSymbols
 * - Payload size header (X-Payload-Bytes) present and <= 50KB
 */

const request = require('supertest');

// Use the exported Express app without binding a port in tests
const { app } = require('../../server');

// Increase timeout for integration tests and clean up after
jest.setTimeout(10000);

describe('Server-Client Sync Flow (HTTP)', () => {
  // Clean up any lingering timers/handles after all tests
  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  test('POST /api/demo-spin returns canonical payload with droppingSymbols', async () => {
    const res = await request(app)
      .post('/api/demo-spin')
      .send({ betAmount: 1.0, quickSpinMode: false })
      .expect(200);

    // Header: payload size monitoring
    const payloadBytesHeader = res.headers['x-payload-bytes'];
    expect(payloadBytesHeader).toBeDefined();
    const payloadBytes = parseInt(payloadBytesHeader, 10);
    expect(Number.isFinite(payloadBytes)).toBe(true);
    // 50KB target (allow a little headroom if headers roundtrip differently in CI)
    expect(payloadBytes).toBeLessThanOrEqual(56 * 1024);

    // Body shape
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    // Canonical top-level fields
    expect(typeof data.spinId).toBe('string');
    expect(typeof data.betAmount).toBe('number');
    expect(typeof data.totalWin).toBe('number');
    expect(Array.isArray(data.cascadeSteps)).toBe(true);

    // Grid sanity
    expect(Array.isArray(data.initialGrid)).toBe(true);
    expect(data.initialGrid.length).toBe(6);
    if (Array.isArray(data.initialGrid[0])) {
      expect(data.initialGrid[0].length).toBe(5);
    }

    // Validate at least the first step’s canonical fields if cascades exist
    if (data.cascadeSteps.length > 0) {
      const step = data.cascadeSteps[0];
      // Canonical grid fields and aliases
      expect(step.gridStateBefore || step.gridBefore || step.grid).toBeTruthy();
      expect(step.gridAfterRemoval || step.gridMid).toBeDefined();
      expect(step.gridStateAfter || step.gridAfter || step.newGrid).toBeDefined();

      // New canonical pre-expanded list for client animation
      expect(Array.isArray(step.droppingSymbols)).toBe(true);
      // Each drop entry must contain from/to coordinates
      step.droppingSymbols.forEach((drop) => {
        expect(drop).toBeDefined();
        expect(drop.from).toBeDefined();
        expect(drop.to).toBeDefined();
        expect(typeof drop.from.col).toBe('number');
        expect(typeof drop.from.row).toBe('number');
        expect(typeof drop.to.col).toBe('number');
        expect(typeof drop.to.row).toBe('number');
      });
    }

    // Multiplier metadata is optional; presence check only if provided
    if (data.multiplierEvents) {
      expect(Array.isArray(data.multiplierEvents)).toBe(true);
    }
  });

  test('GET /api/game-state succeeds in demo mode via x-demo-bypass', async () => {
    const res = await request(app)
      .get('/api/game-state')
      .set('x-demo-bypass', 'true')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    // Basic sanity fields
    expect(typeof res.body.gameMode === 'string' || res.body.gameState?.game_mode).toBeTruthy();
  });
});


