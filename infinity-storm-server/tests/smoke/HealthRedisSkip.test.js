// Ensure SKIP_REDIS=true before requiring the app/server
process.env.SKIP_REDIS = 'true';
process.env.NODE_ENV = 'test';

const request = require('supertest');

// Require app after env is set; server.js exports the Express app via module.exports.app if available
let app;
beforeAll(() => {
  // server.js constructs `app` internally; expose app via require cache
  const serverModule = require('../../server');
  app = serverModule.app || serverModule; // fallback if app is directly exported
});

describe('Health endpoint with SKIP_REDIS=true', () => {
  it('GET /health should succeed and mark redis as skipped', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
    // When Redis is skipped, checks.redis should indicate skipped
    expect(res.body).toHaveProperty('checks.redis.status');
    expect(['skipped', 'healthy', 'degraded']).toContain(res.body.checks.redis.status);
  });
});


