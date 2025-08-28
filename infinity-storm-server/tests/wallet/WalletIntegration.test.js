/**
 * WalletIntegration.test.js - Comprehensive Wallet System Tests
 * 
 * Tests all wallet operations including:
 * - Credit-based transactions
 * - Balance inquiries
 * - Transaction history
 * - Admin adjustments
 * - Anti-fraud validation
 * - Atomic operations
 */

const request = require('supertest');
const { app } = require('../../server');
const { sequelize } = require('../../src/config/database');
const { Player, Transaction } = require('../../src/models');
const WalletService = require('../../src/services/walletService');

describe('Wallet Integration Tests', () => {
    let testPlayer;
    let adminPlayer;
    let playerToken;
    let adminToken;

    beforeAll(async () => {
        // Ensure database is ready
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // Create test players
        testPlayer = await Player.create({
            username: 'wallet_test_player',
            email: 'wallet.test@example.com',
            password_hash: 'hashedpassword123',
            credits: 1000.00,
            is_demo: false,
            status: 'active'
        });

        adminPlayer = await Player.create({
            username: 'wallet_admin',
            email: 'wallet.admin@example.com',
            password_hash: 'hashedpassword123',
            credits: 5000.00,
            is_demo: false,
            is_admin: true,
            status: 'active'
        });

        // Mock authentication tokens
        playerToken = 'mock-player-token';
        adminToken = 'mock-admin-token';

        // Mock authentication middleware
        app.use('/api/wallet', (req, res, next) => {
            if (req.headers.authorization === `Bearer ${playerToken}`) {
                req.user = {
                    id: testPlayer.id,
                    username: testPlayer.username,
                    is_admin: false
                };
            } else if (req.headers.authorization === `Bearer ${adminToken}`) {
                req.user = {
                    id: adminPlayer.id,
                    username: adminPlayer.username,
                    is_admin: true
                };
            }
            next();
        });
    });

    afterEach(async () => {
        // Clean up test data
        await Transaction.destroy({ where: {} });
        await Player.destroy({ where: {} });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Balance Operations', () => {
        test('should retrieve player balance', async () => {
            const response = await request(app)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.balance.player_id).toBe(testPlayer.id);
            expect(response.body.data.balance.balance).toBe(1000.00);
            expect(response.body.data.balance.username).toBe('wallet_test_player');
            expect(response.body.data.balance.is_demo).toBe(false);
            expect(response.body.data.balance.status).toBe('active');
        });

        test('should retrieve wallet status with activity', async () => {
            // Create some transaction history
            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 50.00,
                reference_id: 'test-spin-1'
            });

            const response = await request(app)
                .get('/api/wallet/status')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status.balance).toBe(950.00);
            expect(response.body.data.status.recent_activity).toBeDefined();
            expect(response.body.data.status.status.can_bet).toBe(true);
        });

        test('should validate balance consistency', async () => {
            const response = await request(app)
                .get('/api/wallet/validate')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.validation.valid).toBe(true);
        });
    });

    describe('Transaction History', () => {
        beforeEach(async () => {
            // Create test transactions
            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 100.00,
                reference_id: 'test-spin-1'
            });

            await WalletService.processWin({
                player_id: testPlayer.id,
                amount: 250.00,
                reference_id: 'test-spin-1'
            });

            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 75.00,
                reference_id: 'test-spin-2'
            });
        });

        test('should retrieve transaction history with pagination', async () => {
            const response = await request(app)
                .get('/api/wallet/transactions?page=1&limit=10')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions).toHaveLength(3);
            expect(response.body.data.pagination.current_page).toBe(1);
            expect(response.body.data.pagination.total_count).toBe(3);
        });

        test('should filter transactions by type', async () => {
            const response = await request(app)
                .get('/api/wallet/transactions?type=bet')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions).toHaveLength(2);
            response.body.data.transactions.forEach(tx => {
                expect(tx.type).toBe('bet');
            });
        });

        test('should filter transactions by date range', async () => {
            const dateFrom = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
            const dateTo = new Date().toISOString();

            const response = await request(app)
                .get(`/api/wallet/transactions?date_from=${dateFrom}&date_to=${dateTo}`)
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions.length).toBeGreaterThan(0);
        });

        test('should validate transaction history request parameters', async () => {
            const response = await request(app)
                .get('/api/wallet/transactions?page=invalid')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
        });
    });

    describe('Wallet Statistics', () => {
        beforeEach(async () => {
            // Create varied transaction history
            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 100.00,
                reference_id: 'stats-spin-1'
            });

            await WalletService.processWin({
                player_id: testPlayer.id,
                amount: 150.00,
                reference_id: 'stats-spin-1'
            });

            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 50.00,
                reference_id: 'stats-spin-2'
            });
        });

        test('should retrieve wallet statistics', async () => {
            const response = await request(app)
                .get('/api/wallet/stats?days=30')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.stats.period_days).toBe(30);
            expect(response.body.data.stats.summary.total_transactions).toBe(3);
            expect(response.body.data.stats.gaming.total_bets).toBe(150.00);
            expect(response.body.data.stats.gaming.total_wins).toBe(150.00);
            expect(response.body.data.stats.gaming.net_gaming).toBe(0.00);
        });

        test('should calculate win rate percentage', async () => {
            const response = await request(app)
                .get('/api/wallet/stats')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.stats.gaming.win_rate_percent).toBeGreaterThan(0);
            expect(response.body.data.stats.gaming.spins_count).toBe(2);
        });
    });

    describe('Admin Operations', () => {
        test('should allow admin to adjust player balance', async () => {
            const adjustmentData = {
                player_id: testPlayer.id,
                amount: 500.00,
                reason: 'Test bonus credit for integration testing'
            };

            const response = await request(app)
                .post('/api/wallet/admin/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(adjustmentData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.adjustment.transaction.amount).toBe(500.00);
            expect(response.body.data.adjustment.transaction.type).toBe('adjustment');
            expect(response.body.data.adjustment.balance.current).toBe(1500.00);
        });

        test('should prevent non-admin from making adjustments', async () => {
            const adjustmentData = {
                player_id: testPlayer.id,
                amount: 500.00,
                reason: 'Unauthorized adjustment attempt'
            };

            const response = await request(app)
                .post('/api/wallet/admin/adjust')
                .set('Authorization', `Bearer ${playerToken}`)
                .send(adjustmentData)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Admin permissions required');
        });

        test('should allow admin to view any player balance', async () => {
            const response = await request(app)
                .get(`/api/wallet/admin/balance/${testPlayer.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.balance.player_id).toBe(testPlayer.id);
            expect(response.body.data.balance.balance).toBe(1000.00);
        });

        test('should allow admin to view player transaction history', async () => {
            // Create some transactions
            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 100.00,
                reference_id: 'admin-view-test'
            });

            const response = await request(app)
                .get(`/api/wallet/admin/transactions/${testPlayer.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions.length).toBeGreaterThan(0);
        });

        test('should validate admin adjustment parameters', async () => {
            const invalidAdjustment = {
                player_id: testPlayer.id,
                amount: 0, // Invalid: zero amount
                reason: 'Test'
            };

            const response = await request(app)
                .post('/api/wallet/admin/adjust')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(invalidAdjustment)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
        });
    });

    describe('Wallet Service Direct Tests', () => {
        test('should process bet transactions atomically', async () => {
            const initialBalance = await WalletService.getBalance(testPlayer.id);
            
            const result = await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 200.00,
                reference_id: 'atomic-bet-test'
            });

            expect(result.success).toBe(true);
            expect(result.transaction.type).toBe('bet');
            expect(result.transaction.amount).toBe(-200.00);
            expect(result.balance.current).toBe(800.00);

            // Verify balance consistency
            const newBalance = await WalletService.getBalance(testPlayer.id);
            expect(newBalance.balance).toBe(800.00);
        });

        test('should process win transactions atomically', async () => {
            const result = await WalletService.processWin({
                player_id: testPlayer.id,
                amount: 350.00,
                reference_id: 'atomic-win-test'
            });

            expect(result.success).toBe(true);
            expect(result.transaction.type).toBe('win');
            expect(result.transaction.amount).toBe(350.00);
            expect(result.balance.current).toBe(1350.00);
        });

        test('should reject bets with insufficient funds', async () => {
            await expect(
                WalletService.processBet({
                    player_id: testPlayer.id,
                    amount: 1500.00, // More than available credits
                    reference_id: 'insufficient-funds-test'
                })
            ).rejects.toThrow('Insufficient funds');
        });

        test('should validate balance consistency after multiple transactions', async () => {
            // Process multiple transactions
            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 100.00,
                reference_id: 'consistency-test-1'
            });

            await WalletService.processWin({
                player_id: testPlayer.id,
                amount: 250.00,
                reference_id: 'consistency-test-1'
            });

            await WalletService.processBet({
                player_id: testPlayer.id,
                amount: 75.00,
                reference_id: 'consistency-test-2'
            });

            const validation = await WalletService.validateBalanceConsistency(testPlayer.id);
            expect(validation.valid).toBe(true);
            expect(validation.transactions_validated).toBe(3);
        });

        test('should handle free spins purchase transactions', async () => {
            const result = await WalletService.processFreeSpinsPurchase({
                player_id: testPlayer.id,
                cost: 300.00,
                spins_count: 10
            });

            expect(result.success).toBe(true);
            expect(result.transaction.type).toBe('purchase');
            expect(result.transaction.amount).toBe(-300.00);
            expect(result.balance.current).toBe(700.00);
        });
    });

    describe('Security and Anti-Fraud', () => {
        test('should handle large transactions with security logging', async () => {
            // This should trigger security logging but still succeed
            const result = await WalletService.processWin({
                player_id: testPlayer.id,
                amount: 15000.00, // Large amount
                reference_id: 'large-transaction-test'
            });

            expect(result.success).toBe(true);
            expect(result.transaction.amount).toBe(15000.00);
        });

        test('should rate limit wallet operations', async () => {
            // Make many rapid requests to trigger rate limiting
            const requests = Array.from({ length: 35 }, (_, i) => 
                request(app)
                    .get('/api/wallet/balance')
                    .set('Authorization', `Bearer ${playerToken}`)
            );

            const results = await Promise.allSettled(requests);
            
            // Some requests should be rate limited (429 status)
            const rateLimited = results.filter(result => 
                result.status === 'fulfilled' && result.value.status === 429
            );

            expect(rateLimited.length).toBeGreaterThan(0);
        });

        test('should validate player account status for wallet operations', async () => {
            // Suspend player account
            await testPlayer.update({ status: 'suspended' });

            const response = await request(app)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Wallet access denied');
        });
    });

    describe('Error Handling', () => {
        test('should handle wallet service errors gracefully', async () => {
            // Test with invalid player ID
            await expect(
                WalletService.getBalance('invalid-uuid')
            ).rejects.toThrow();
        });

        test('should return proper error responses for invalid requests', async () => {
            const response = await request(app)
                .get('/api/wallet/transactions?limit=invalid')
                .set('Authorization', `Bearer ${playerToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
        });

        test('should handle concurrent transaction conflicts', async () => {
            // Simulate concurrent bet requests
            const concurrentBets = Array.from({ length: 5 }, () =>
                WalletService.processBet({
                    player_id: testPlayer.id,
                    amount: 250.00,
                    reference_id: 'concurrent-test-' + Math.random()
                })
            );

            const results = await Promise.allSettled(concurrentBets);
            
            // Only some should succeed due to insufficient funds
            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');
            
            expect(successful.length).toBeLessThan(5);
            expect(failed.length).toBeGreaterThan(0);
        });
    });
});