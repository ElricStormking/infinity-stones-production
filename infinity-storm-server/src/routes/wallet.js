/**
 * wallet.js - Wallet Routes
 * 
 * Defines RESTful API endpoints for wallet management including
 * balance inquiries, transaction history, admin operations, and security features.
 * 
 * Routes:
 * - GET /api/wallet/balance - Get current balance
 * - GET /api/wallet/status - Get wallet status
 * - GET /api/wallet/transactions - Get transaction history
 * - GET /api/wallet/stats - Get wallet statistics
 * - GET /api/wallet/validate - Validate balance consistency
 * - POST /api/wallet/admin/adjust - Admin balance adjustment
 * - GET /api/wallet/admin/balance/:playerId - Get player balance (admin)
 * - GET /api/wallet/admin/transactions/:playerId - Get player transactions (admin)
 * - GET /api/wallet/admin/validate/:playerId - Validate player balance (admin)
 */

const express = require('express');
const router = express.Router();

const WalletController = require('../controllers/wallet');
const WalletValidation = require('../middleware/walletValidation');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all wallet routes
router.use(authenticate);

// Apply rate limiting to all wallet operations
router.use(WalletValidation.rateLimitWalletOperations);

// Apply player status validation to all wallet operations
router.use(WalletValidation.validatePlayerStatus);

/**
 * Player Wallet Operations
 */

/**
 * @route GET /api/wallet/balance
 * @desc Get current wallet balance
 * @access Private (Player)
 */
router.get('/balance',
    WalletValidation.validateBalanceInquiry,
    WalletValidation.logWalletOperation('get_balance'),
    WalletController.getBalance
);

/**
 * @route GET /api/wallet/status
 * @desc Get comprehensive wallet status
 * @access Private (Player)
 */
router.get('/status',
    WalletValidation.logWalletOperation('get_status'),
    WalletController.getWalletStatus
);

/**
 * @route GET /api/wallet/transactions
 * @desc Get transaction history with pagination and filtering
 * @access Private (Player)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 50, max: 100)
 * @query {string} type - Transaction type filter
 * @query {string} date_from - Start date (ISO 8601)
 * @query {string} date_to - End date (ISO 8601)
 * @query {boolean} include_admin - Include admin transactions
 */
router.get('/transactions',
    WalletValidation.validateTransactionHistoryQuery,
    WalletValidation.validateDateRange,
    WalletValidation.normalizeNumericInputs,
    WalletValidation.logWalletOperation('get_transactions'),
    WalletController.getTransactionHistory
);

/**
 * @route GET /api/wallet/stats
 * @desc Get wallet statistics and analytics
 * @access Private (Player)
 * @query {number} days - Number of days to analyze (default: 30, max: 365)
 * @query {boolean} include_admin_adjustments - Include admin adjustments
 */
router.get('/stats',
    WalletValidation.validateWalletStatsQuery,
    WalletValidation.normalizeNumericInputs,
    WalletValidation.logWalletOperation('get_stats'),
    WalletController.getWalletStats
);

/**
 * @route GET /api/wallet/validate
 * @desc Validate balance consistency
 * @access Private (Player)
 */
router.get('/validate',
    WalletValidation.logWalletOperation('validate_balance'),
    WalletController.validateBalance
);

/**
 * Admin Wallet Operations
 * Requires admin permissions
 */

/**
 * @route POST /api/wallet/admin/adjust
 * @desc Adjust player balance (admin only)
 * @access Private (Admin)
 * @body {string} player_id - Target player UUID
 * @body {number} amount - Adjustment amount (positive or negative)
 * @body {string} reason - Detailed reason for adjustment
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/admin/adjust',
    WalletValidation.validateAdminPermissions,
    WalletValidation.validateAdminAdjustment,
    WalletValidation.validateTransactionSecurity,
    WalletValidation.normalizeNumericInputs,
    WalletValidation.logWalletOperation('admin_adjust_balance'),
    WalletController.adminAdjustBalance
);

/**
 * @route GET /api/wallet/admin/balance/:playerId
 * @desc Get player balance (admin only)
 * @access Private (Admin)
 * @param {string} playerId - Player UUID
 */
router.get('/admin/balance/:playerId',
    WalletValidation.validateAdminPermissions,
    WalletValidation.validatePlayerIdParam,
    WalletValidation.logWalletOperation('admin_get_balance'),
    WalletController.adminGetBalance
);

/**
 * @route GET /api/wallet/admin/transactions/:playerId
 * @desc Get player transaction history (admin only)
 * @access Private (Admin)
 * @param {string} playerId - Player UUID
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 50, max: 100)
 * @query {string} type - Transaction type filter
 * @query {string} date_from - Start date (ISO 8601)
 * @query {string} date_to - End date (ISO 8601)
 */
router.get('/admin/transactions/:playerId',
    WalletValidation.validateAdminPermissions,
    WalletValidation.validatePlayerIdParam,
    WalletValidation.validateTransactionHistoryQuery,
    WalletValidation.validateDateRange,
    WalletValidation.normalizeNumericInputs,
    WalletValidation.logWalletOperation('admin_get_transactions'),
    WalletController.adminGetTransactionHistory
);

/**
 * @route GET /api/wallet/admin/validate/:playerId
 * @desc Validate player balance consistency (admin only)
 * @access Private (Admin)
 * @param {string} playerId - Player UUID
 */
router.get('/admin/validate/:playerId',
    WalletValidation.validateAdminPermissions,
    WalletValidation.validatePlayerIdParam,
    WalletValidation.logWalletOperation('admin_validate_balance'),
    WalletController.adminValidateBalance
);

// Error handling middleware temporarily removed due to issues

module.exports = router;