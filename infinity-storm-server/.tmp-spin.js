const { app } = require('./server');
const request = require('supertest');
(async () => {
  const res = await request(app)
    .post('/api/spin')
    .send({ bet: 1.0, quickSpinMode: true, freeSpinsActive: false, accumulatedMultiplier: 1 });
  console.log('status', res.statusCode);
  console.log('body', res.body);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
