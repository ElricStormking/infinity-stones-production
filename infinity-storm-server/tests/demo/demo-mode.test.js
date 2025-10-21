/**
 * Demo Mode Tests
 * Validates free-to-play demo mode functionality
 */

const request = require('supertest');
const { getDemoState, setDemoState, resetDemoState, DEMO_START_BALANCE } = require('../../src/demo/demoSession');
const { DEMO_CONFIG } = require('../../src/game/math/profileDemo');

// Mock Express app for testing
const express = require('express');
const cookieParser = require('cookie-parser');
const apiRoutes = require('../../src/routes/api');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiRoutes);

describe('Demo Mode', () => {
  describe('Demo Session Management', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn()
      };
    });

    test('resetDemoState creates fresh session with starting balance', () => {
      const state = resetDemoState(mockRes);
      
      expect(state.balance).toBe(DEMO_START_BALANCE);
      expect(state.game_state.game_mode).toBe('base');
      expect(state.game_state.free_spins_remaining).toBe(0);
      expect(state.game_state.accumulated_multiplier).toBe(1);
      expect(state.session_id).toBeTruthy();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'demo_session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax'
        })
      );
    });

    test('getDemoState returns null for missing cookie', () => {
      const mockReq = { cookies: {} };
      const state = getDemoState(mockReq);
      
      expect(state).toBeNull();
    });

    test('getDemoState returns null for invalid JWT', () => {
      const mockReq = { cookies: { demo_session: 'invalid.jwt.token' } };
      const state = getDemoState(mockReq);
      
      expect(state).toBeNull();
    });
  });

  describe('Demo Math Profile', () => {
    test('DEMO_CONFIG has boosted RTP', () => {
      expect(DEMO_CONFIG.RTP).toBeGreaterThan(1);
      expect(DEMO_CONFIG.RTP).toBeLessThanOrEqual(5); // Reasonable upper bound
    });

    test('DEMO_CONFIG has higher scatter chance', () => {
      const normalScatterChance = 0.035;
      expect(DEMO_CONFIG.SCATTER_CHANCE).toBeGreaterThan(normalScatterChance);
    });

    test('DEMO_CONFIG has higher random multiplier trigger chance', () => {
      const normalRMChance = 0.4;
      expect(DEMO_CONFIG.RANDOM_MULTIPLIER.TRIGGER_CHANCE).toBeGreaterThan(normalRMChance);
    });

    test('DEMO_CONFIG symbol weights favor high-value symbols', () => {
      // Thanos should have higher weight in demo mode than base game
      expect(DEMO_CONFIG.SYMBOL_WEIGHTS.thanos).toBeGreaterThanOrEqual(11);
      expect(DEMO_CONFIG.SYMBOL_WEIGHTS.scarlet_witch).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Demo Endpoints', () => {
    describe('POST /api/demo-spin', () => {
      test('processes spin without authentication', async () => {
        const response = await request(app)
          .post('/api/demo-spin')
          .send({ betAmount: 1.0 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('spinId');
        expect(response.body.data).toHaveProperty('initialGrid');
        expect(response.body.data).toHaveProperty('totalWin');
        expect(response.body.data).toHaveProperty('balance');
        expect(response.body.data.metadata.mode).toBe('demo');
      });

      test('returns insufficient balance error when balance too low', async () => {
        // First spin to reduce balance
        let response = await request(app)
          .post('/api/demo-spin')
          .send({ betAmount: DEMO_START_BALANCE })
          .expect(200);

        // Get cookie from first response
        const cookies = response.headers['set-cookie'];

        // Try to spin again with high bet
        response = await request(app)
          .post('/api/demo-spin')
          .set('Cookie', cookies)
          .send({ betAmount: 1000 })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('INSUFFICIENT_BALANCE');
      });

      test('sets demo_session cookie', async () => {
        const response = await request(app)
          .post('/api/demo-spin')
          .send({ betAmount: 1.0 })
          .expect(200);

        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.some(c => c.startsWith('demo_session='))).toBe(true);
      });

      test('updates balance after win', async () => {
        const response = await request(app)
          .post('/api/demo-spin')
          .send({ betAmount: 1.0 })
          .expect(200);

        const newBalance = response.body.data.balance;
        const totalWin = response.body.data.totalWin;

        // Balance should be: starting - bet + win
        const expectedBalance = DEMO_START_BALANCE - 1.0 + totalWin;
        expect(newBalance).toBeCloseTo(expectedBalance, 2);
      });
    });

    describe('GET /api/demo/balance', () => {
      test('returns demo balance and game state', async () => {
        const response = await request(app)
          .get('/api/demo/balance')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('balance');
        expect(response.body).toHaveProperty('game_state');
        expect(response.body).toHaveProperty('session_id');
      });
    });

    describe('POST /api/demo/reset', () => {
      test('resets balance to starting amount', async () => {
        // First, do a spin to change balance
        let response = await request(app)
          .post('/api/demo-spin')
          .send({ betAmount: 10.0 })
          .expect(200);

        const cookies = response.headers['set-cookie'];

        // Then reset
        response = await request(app)
          .post('/api/demo/reset')
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.balance).toBe(DEMO_START_BALANCE);
        expect(response.body.game_state.game_mode).toBe('base');
        expect(response.body.game_state.free_spins_remaining).toBe(0);
      });
    });
  });

  describe('Database Isolation', () => {
    test('demo spins do not write to database', async () => {
      // This test requires Supabase connection
      // Mock or skip if Supabase not available
      const { supabaseAdmin } = require('../../src/db/supabaseClient');

      // Count spin_results before
      const { count: countBefore } = await supabaseAdmin
        .from('spin_results')
        .select('*', { count: 'exact', head: true });

      // Do a demo spin
      await request(app)
        .post('/api/demo-spin')
        .send({ betAmount: 1.0 })
        .expect(200);

      // Count spin_results after
      const { count: countAfter } = await supabaseAdmin
        .from('spin_results')
        .select('*', { count: 'exact', head: true });

      // Count should be unchanged
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('RTP Validation', () => {
    test('demo mode has higher RTP than real mode over 1000 spins', async () => {
      const numSpins = 1000;
      const betAmount = 1.0;
      
      let totalBet = 0;
      let totalWin = 0;
      let cookies = [];

      for (let i = 0; i < numSpins; i++) {
        const response = await request(app)
          .post('/api/demo-spin')
          .set('Cookie', cookies)
          .send({ betAmount })
          .expect(200);

        cookies = response.headers['set-cookie'] || cookies;
        
        totalBet += betAmount;
        totalWin += response.body.data.totalWin;

        // Reset balance periodically to avoid running out
        if (response.body.data.balance < 10) {
          const resetResponse = await request(app)
            .post('/api/demo/reset')
            .set('Cookie', cookies)
            .expect(200);
          cookies = resetResponse.headers['set-cookie'] || cookies;
        }
      }

      const actualRTP = totalWin / totalBet;
      
      // Demo mode should have RTP > 1.5 (150%) over 1000 spins
      expect(actualRTP).toBeGreaterThan(1.5);
      
      console.log(`Demo Mode RTP over ${numSpins} spins: ${(actualRTP * 100).toFixed(2)}%`);
      console.log(`Total Bet: $${totalBet}, Total Win: $${totalWin.toFixed(2)}`);
    }, 60000); // 60 second timeout for 1000 spins
  });
});

