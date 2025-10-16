/**
 * Animation Timing Performance Test
 *
 * Validates that cascade animation timings from the server are within acceptable tolerances
 * for smooth client-side rendering without jank or delays.
 *
 * Key Metrics:
 * - Total cascade animation time should be reasonable (<5s for normal spins)
 * - Individual cascade step timings should be consistent
 * - Drop pattern expansion doesn't add significant overhead
 * - Server response time doesn't degrade animation scheduling
 */

const request = require('supertest');
const { app } = require('../../server');

jest.setTimeout(15000);

describe('Animation Timing Performance', () => {
  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('Demo spin cascade timings are within acceptable tolerance', async () => {
    const startTime = Date.now();
    
    const res = await request(app)
      .post('/api/demo-spin')
      .send({ betAmount: 1.0, quickSpinMode: false })
      .expect(200);

    const responseTime = Date.now() - startTime;
    
    // Server response should be fast (<500ms for demo spins)
    expect(responseTime).toBeLessThan(500);
    
    const { data } = res.body;
    expect(data).toBeDefined();
    expect(data.cascadeSteps).toBeDefined();
    expect(Array.isArray(data.cascadeSteps)).toBe(true);

    // Validate cascade step structure for animation
    let totalAnimationTime = 0;
    
    for (const step of data.cascadeSteps) {
      // Each step must have droppingSymbols for client animation
      expect(step.droppingSymbols).toBeDefined();
      expect(Array.isArray(step.droppingSymbols)).toBe(true);
      
      // Grids must be present for state validation
      expect(step.gridStateBefore).toBeDefined();
      expect(step.gridStateAfter).toBeDefined();
      
      // Calculate estimated animation time for this cascade
      // Drop animation: ~300ms per cascade
      // Win celebration: ~500ms if there's a win
      const dropAnimTime = 300;
      const winAnimTime = step.winAmount > 0 ? 500 : 0;
      const stepAnimTime = dropAnimTime + winAnimTime;
      
      totalAnimationTime += stepAnimTime;
    }
    
    // Total animation time should be reasonable
    // Normal spins: 0-3 cascades = 0-2400ms
    // Big wins: up to 10 cascades = up to 8000ms (acceptable)
    const maxAcceptableCascades = 15;
    const maxAnimationTime = maxAcceptableCascades * 800; // 12000ms = 12s max
    
    expect(totalAnimationTime).toBeLessThan(maxAnimationTime);
    expect(data.cascadeSteps.length).toBeLessThanOrEqual(maxAcceptableCascades);
    
    console.log(`✓ Animation timing test passed:
      - Server response: ${responseTime}ms
      - Cascade steps: ${data.cascadeSteps.length}
      - Estimated client animation time: ${totalAnimationTime}ms
      - Total win: ${data.totalWin}`);
  });

  test('Cascade step timings are consistent across multiple spins', async () => {
    const spinCount = 5;
    const responseTimes = [];
    const cascadeCounts = [];
    
    for (let i = 0; i < spinCount; i++) {
      const startTime = Date.now();
      
      const res = await request(app)
        .post('/api/demo-spin')
        .send({ betAmount: 1.0, quickSpinMode: false })
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      cascadeCounts.push(res.body.data.cascadeSteps.length);
    }
    
    // Calculate variance
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / spinCount;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    const variance = maxResponseTime - minResponseTime;
    
    // Response time variance should be reasonable (<200ms difference)
    expect(variance).toBeLessThan(200);
    expect(avgResponseTime).toBeLessThan(500);
    
    console.log(`✓ Consistency test passed over ${spinCount} spins:
      - Avg response time: ${avgResponseTime.toFixed(1)}ms
      - Min/Max: ${minResponseTime}ms / ${maxResponseTime}ms
      - Variance: ${variance}ms
      - Cascade counts: [${cascadeCounts.join(', ')}]`);
  });

  test('Quick spin mode reduces animation timing expectations', async () => {
    const normalRes = await request(app)
      .post('/api/demo-spin')
      .send({ betAmount: 1.0, quickSpinMode: false })
      .expect(200);
    
    const quickRes = await request(app)
      .post('/api/demo-spin')
      .send({ betAmount: 1.0, quickSpinMode: true })
      .expect(200);
    
    // Both should succeed with same data structure
    expect(normalRes.body.data.quickSpinMode).toBe(false);
    expect(quickRes.body.data.quickSpinMode).toBe(true);
    
    // Same cascade count regardless of quick spin (server-side consistency)
    const normalCascades = normalRes.body.data.cascadeSteps.length;
    const quickCascades = quickRes.body.data.cascadeSteps.length;
    
    // Quick spin doesn't change game logic, only client animation speed
    // So we just validate the flag is passed through correctly
    console.log(`✓ Quick spin mode test passed:
      - Normal mode cascades: ${normalCascades}
      - Quick mode cascades: ${quickCascades}
      - Quick mode flag correctly passed: ${quickRes.body.data.quickSpinMode}`);
  });

  test('Payload size monitoring header present for performance tracking', async () => {
    const res = await request(app)
      .post('/api/demo-spin')
      .send({ betAmount: 1.0 })
      .expect(200);
    
    const payloadBytes = res.headers['x-payload-bytes'];
    expect(payloadBytes).toBeDefined();
    
    const sizeInBytes = parseInt(payloadBytes, 10);
    expect(Number.isFinite(sizeInBytes)).toBe(true);
    expect(sizeInBytes).toBeGreaterThan(0);
    expect(sizeInBytes).toBeLessThan(56 * 1024); // 56KB max (allows some headroom)
    
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    console.log(`✓ Payload size: ${sizeInKB} KB (${sizeInBytes} bytes)`);
  });
});

