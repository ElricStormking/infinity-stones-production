const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  ensureTestPlayer,
  getPlayerBalance,
  updatePlayerBalance,
  createTransaction
} = require('../db/supabaseClient');
const { logger } = require('../utils/logger');
const financialLogger = require('../services/financialTransactionLogger');

const router = express.Router();

const PORTAL_MOCK_ENABLED = process.env.PORTAL_MOCK_ENABLED !== 'false';
const PORTAL_MOCK_SECRET = process.env.PORTAL_MOCK_SECRET || 'portal-dev-secret';
const DEFAULT_CREDIT_AMOUNT = 10000;

const validateRequest = [
  body('playerId')
    .trim()
    .isLength({ min: 3, max: 64 })
    .withMessage('Player ID must be between 3 and 64 characters'),
  body('amount')
    .optional()
    .isFloat({ gt: 0, lt: 1000000 })
    .withMessage('Amount must be greater than 0 and less than 1,000,000'),
  body('notes')
    .optional()
    .isLength({ max: 250 })
    .withMessage('Notes must be 250 characters or fewer')
];

router.use((req, res, next) => {
  if (!PORTAL_MOCK_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Mock portal is disabled'
    });
  }
  return next();
});

router.use((req, res, next) => {
  const providedSecret = req.get('x-portal-secret') || req.body?.secret || req.query?.secret;
  if (PORTAL_MOCK_SECRET && providedSecret !== PORTAL_MOCK_SECRET) {
    return res.status(401).json({
      success: false,
      message: 'Invalid portal secret'
    });
  }
  return next();
});

router.post(
  '/credit',
  express.json(),
  validateRequest,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      const {
        playerId,
        amount = DEFAULT_CREDIT_AMOUNT,
        notes = null
      } = req.body;

      const creditAmount = parseFloat(amount);
      if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
      }

      const portalPlayerResult = await ensureTestPlayer(
        playerId.trim(),
        {
          allowCreate: true,
          markDemo: false,
          returnPassword: true
        }
      );

      if (portalPlayerResult?.error || !portalPlayerResult.player) {
        return res.status(500).json({
          success: false,
          message: portalPlayerResult?.error || 'Failed to resolve test player'
        });
      }

      const { player, created, password: defaultPassword } = portalPlayerResult;

      const balanceResult = await getPlayerBalance(player.id || playerId.trim());
      if (balanceResult?.error) {
        return res.status(500).json({
          success: false,
          message: balanceResult.error
        });
      }

      const balanceBefore = parseFloat(balanceResult.balance || 0);
      const balanceAfter = parseFloat((balanceBefore + creditAmount).toFixed(2));

      const updateResult = await updatePlayerBalance(player.id, balanceAfter);
      if (updateResult?.error) {
        return res.status(500).json({
          success: false,
          message: updateResult.error
        });
      }

      const description = notes
        ? `Mock portal credit: ${creditAmount.toFixed(2)} (${notes})`
        : `Mock portal credit: ${creditAmount.toFixed(2)}`;

      const transactionResult = await createTransaction(
        player.id,
        'deposit',
        creditAmount,
        balanceBefore,
        balanceAfter,
        description
      );

      if (transactionResult?.error) {
        return res.status(500).json({
          success: false,
          message: transactionResult.error
        });
      }

      const transaction = transactionResult.transaction;

      // Log financial transaction for portal deposit
      await financialLogger.logPortalDeposit(
        player.id,
        creditAmount,
        balanceBefore,
        balanceAfter,
        transaction?.id
      );

      logger.info('Mock portal credit applied', {
        player_id: player.id,
        username: player.username,
        amount: creditAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        transaction_id: transaction?.id,
        notes: notes || undefined,
        source_ip: req.ip,
        user_agent: req.get('User-Agent')
      });

      return res.status(200).json({
        success: true,
        message: 'Mock transaction recorded successfully',
        data: {
          player: {
            id: player.id,
            username: player.username,
            is_demo: player.is_demo,
            default_password: created ? defaultPassword : undefined,
            newly_created: created
          },
          transaction: {
            id: transaction?.id,
            type: transaction?.type,
            amount: transaction?.amount,
            balance_before: transaction?.balance_before,
            balance_after: transaction?.balance_after,
            description: transaction?.description,
            created_at: transaction?.created_at
          }
        }
      });
    } catch (error) {
      logger.error('Mock portal credit failed', {
        error: error.message,
        stack: error.stack
      });
      return res.status(500).json({
        success: false,
        message: 'Mock portal request failed',
        error: error.message
      });
    }
  }
);

module.exports = router;
