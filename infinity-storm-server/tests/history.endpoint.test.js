/**
 * History Endpoint Tests
 */
const request = require('supertest');

// Mock Supabase client calls so tests don't require a local Supabase stack
jest.mock('../src/db/supabaseClient', () => ({
  getDemoPlayer: jest.fn().mockResolvedValue({ id: 'demo_player_id' }),
  getSpinHistory: jest.fn().mockResolvedValue({
    table: 'spin_results',
    rows: [
      {
        created_at: '2025-01-01T00:00:00.000Z',
        spin_id: 'spin_123',
        bet_amount: 1,
        total_win: 0,
        game_mode: 'base'
      }
    ],
    total: 1
  })
}));

const { app } = require('../server');

describe('GET /api/history/spins', () => {
  it('returns paginated history with required fields', async () => {
    const res = await request(app)
      .get('/api/history/spins?page=1&limit=2&order=desc')
      .set('Origin', 'http://localhost:3001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
    const row = res.body.data[0];
    expect(row).toHaveProperty('bet_time');
    expect(row).toHaveProperty('spin_id');
    expect(row).toHaveProperty('bet_amount');
    expect(row).toHaveProperty('total_win');
    expect(row).toHaveProperty('game_mode');
  });
});


