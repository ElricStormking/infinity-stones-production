/**
 * Portal Mock Transactions Integration Test (with mocked Supabase client)
 */

const request = require('supertest');

jest.mock('../../src/db/supabaseClient', () => {
  return {
    ensureTestPlayer: jest.fn(),
    getPlayerBalance: jest.fn(),
    updatePlayerBalance: jest.fn(),
    createTransaction: jest.fn()
  };
});

const { app } = require('../../server');
const supabaseClient = require('../../src/db/supabaseClient');

describe('Portal Mock Transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /portal/mock/credit creates Supabase transaction record', async () => {
    supabaseClient.ensureTestPlayer.mockResolvedValue({
      player: {
        id: 'player-1',
        username: 'portal_test_player',
        is_demo: false
      },
      created: false,
      password: undefined
    });

    supabaseClient.getPlayerBalance.mockResolvedValue({
      balance: 100.0
    });

    supabaseClient.updatePlayerBalance.mockResolvedValue({
      success: true,
      balance: 10100.0
    });

    supabaseClient.createTransaction.mockResolvedValue({
      success: true,
      transaction: {
        id: 'txn_123',
        type: 'deposit',
        amount: 10000,
        balance_before: 100.0,
        balance_after: 10100.0,
        description: 'Mock portal credit: 10000.00 (QA run)',
        created_at: '2025-01-01T00:00:00.000Z'
      }
    });

    const response = await request(app)
      .post('/portal/mock/credit')
      .set('x-portal-secret', process.env.PORTAL_MOCK_SECRET || 'portal-dev-secret')
      .send({
        playerId: 'portal_test_player',
        amount: 10000,
        notes: 'QA run'
      })
      .expect(200);

    expect(supabaseClient.ensureTestPlayer).toHaveBeenCalledWith('portal_test_player', {
      allowCreate: true,
      markDemo: false,
      returnPassword: true
    });
    expect(supabaseClient.getPlayerBalance).toHaveBeenCalledWith('player-1');
    expect(supabaseClient.updatePlayerBalance).toHaveBeenCalledWith('player-1', 10100.0);
    expect(supabaseClient.createTransaction).toHaveBeenCalledWith(
      'player-1',
      'deposit',
      10000,
      100.0,
      10100.0,
      'Mock portal credit: 10000.00 (QA run)'
    );

    expect(response.body.success).toBe(true);
    expect(response.body.data.transaction.id).toBe('txn_123');
    expect(response.body.data.transaction.type).toBe('deposit');
    expect(response.body.data.player.username).toBe('portal_test_player');
  });

  test('POST /portal/mock/credit requires valid portal secret', async () => {
    const res = await request(app)
      .post('/portal/mock/credit')
      .send({
        playerId: 'portal_test_player'
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid portal secret/i);
    expect(supabaseClient.ensureTestPlayer).not.toHaveBeenCalled();
  });
});
