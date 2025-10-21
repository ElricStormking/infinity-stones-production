/**
 * Demo Session Management
 * Stateless JWT-based session for free-to-play demo mode
 * No database writes, all state in signed cookie
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const DEMO_JWT_SECRET = process.env.DEMO_JWT_SECRET || 'demo-secret-change-in-production';
const DEMO_START_BALANCE = parseFloat(process.env.DEMO_START_BALANCE) || 10000;
const DEMO_COOKIE_NAME = 'demo_session';
const DEMO_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Get demo state from request cookie
 * @param {Object} req - Express request
 * @returns {Object|null} Demo state or null if not found/invalid
 */
function getDemoState(req) {
  try {
    const cookie = req.cookies?.[DEMO_COOKIE_NAME];
    if (!cookie) {
      return null;
    }

    const decoded = jwt.verify(cookie, DEMO_JWT_SECRET);
    
    // Validate structure
    if (!decoded.demo || !decoded.session_id) {
      console.warn('[DemoSession] Invalid demo session structure');
      return null;
    }

    return {
      session_id: decoded.session_id,
      balance: typeof decoded.balance === 'number' ? decoded.balance : DEMO_START_BALANCE,
      game_state: decoded.game_state || {
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1
      },
      issued_at: decoded.iat,
      expires_at: decoded.exp
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.log('[DemoSession] Token expired, will create new session');
    } else if (err.name === 'JsonWebTokenError') {
      console.warn('[DemoSession] Invalid JWT:', err.message);
    } else {
      console.error('[DemoSession] Error reading demo state:', err.message);
    }
    return null;
  }
}

/**
 * Set demo state as signed cookie
 * @param {Object} res - Express response
 * @param {Object} state - Demo state to persist
 */
function setDemoState(res, state) {
  try {
    const payload = {
      demo: true,
      session_id: state.session_id || uuidv4(),
      balance: typeof state.balance === 'number' ? state.balance : DEMO_START_BALANCE,
      game_state: state.game_state || {
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1
      }
    };

    const token = jwt.sign(payload, DEMO_JWT_SECRET, {
      expiresIn: DEMO_COOKIE_MAX_AGE
    });

    res.cookie(DEMO_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DEMO_COOKIE_MAX_AGE * 1000 // Convert to milliseconds
    });

    console.log('[DemoSession] Set demo state:', {
      session_id: payload.session_id.substring(0, 8),
      balance: payload.balance,
      game_mode: payload.game_state.game_mode
    });

    return payload;
  } catch (err) {
    console.error('[DemoSession] Error setting demo state:', err.message);
    throw err;
  }
}

/**
 * Reset demo state to initial values
 * @param {Object} res - Express response
 * @returns {Object} Fresh demo state
 */
function resetDemoState(res) {
  const freshState = {
    session_id: uuidv4(),
    balance: DEMO_START_BALANCE,
    game_state: {
      game_mode: 'base',
      free_spins_remaining: 0,
      accumulated_multiplier: 1
    }
  };

  setDemoState(res, freshState);
  console.log('[DemoSession] Demo state reset to initial values');
  
  return freshState;
}

/**
 * Initialize demo state if not exists
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object} Demo state (existing or new)
 */
function initDemoState(req, res) {
  let state = getDemoState(req);
  
  if (!state) {
    console.log('[DemoSession] No valid demo session found, creating new one');
    state = resetDemoState(res);
  }
  
  return state;
}

/**
 * Clear demo cookie
 * @param {Object} res - Express response
 */
function clearDemoState(res) {
  res.clearCookie(DEMO_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  console.log('[DemoSession] Demo cookie cleared');
}

module.exports = {
  getDemoState,
  setDemoState,
  resetDemoState,
  initDemoState,
  clearDemoState,
  DEMO_START_BALANCE,
  DEMO_COOKIE_NAME
};

