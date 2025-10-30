process.env.PORT = process.env.PORT || '0';
const request = require('supertest');
const { app, server } = require('../../server');

describe('Smoke: API health and spin', () => {
afterAll((done) => {
  // In Jest, server isn't bound (PORT=0, isTestEnv=true). Only close if actually listening.
  if (server && server.listening) {
    server.close(done);
  } else {
    done();
  }
});

  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });

  it('POST /api/demo-spin returns a demo spin result', async () => {
    const res = await request(app)
      .post('/api/demo-spin')
      .set('x-demo-bypass', 'true')
      .set('X-Player-Id', 'smoke_test_player')
      .send({ betAmount: 1.0, quickSpinMode: true });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data.spinId');
    expect(res.body).toHaveProperty('data.totalWin');
  });
});


