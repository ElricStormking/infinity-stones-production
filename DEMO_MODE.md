# Demo Mode Documentation

## Overview

The Infinity Storm game now includes a **free-to-play demo mode** that allows players to experience the game without authentication or real money. Demo mode features:

- **No login required** - instant play
- **$10,000 virtual starting balance** - persisted in browser cookie
- **Boosted RTP (~300%)** - more wins, bigger payouts
- **Higher bonus triggers** - 3x chance for Random Multipliers and Free Spins
- **Zero database writes** - no spin history or transaction records
- **Easy upgrade path** - "Play for Real" button redirects to provider login

## Architecture

### Server-Side

1. **Demo Session Management** (`infinity-storm-server/src/demo/demoSession.js`)
   - Stateless JWT stored in httpOnly cookie (`demo_session`)
   - Payload: `{ demo: true, session_id, balance, game_state, iat, exp }`
   - 7-day expiry

2. **Demo Math Profile** (`infinity-storm-server/src/game/math/profileDemo.js`)
   - Target RTP: 300% (configurable via `DEMO_RTP_TARGET`)
   - Boosted symbol weights favor higher-value symbols
   - 3x scatter chance (more Free Spins triggers)
   - 3x random multiplier chance
   - Larger multiplier values in distribution

3. **Demo Endpoints** (`infinity-storm-server/src/routes/api.js`)
   - `POST /api/demo-spin` - Process demo spin (cookie-based state, no DB)
   - `GET /api/demo/balance` - Get current demo balance and game state
   - `POST /api/demo/reset` - Reset demo balance to $10,000

4. **Game Engine Mode** (`infinity-storm-server/src/game/gameEngine.js`)
   - Constructor accepts `options.mode` ('real' | 'demo')
   - Loads appropriate math profile based on mode
   - Strict guard: demo math never leaks to real mode

### Client-Side

1. **NetworkService** (`src/services/NetworkService.js`)
   - Auto-detects demo mode (no auth token)
   - `withCredentials: true` for cookie round-trip
   - Helpers: `getDemoBalance()`, `resetDemoBalance()`, `isDemoMode()`

2. **UIManager** (`src/managers/UIManager.js`)
   - **DEMO badge** (top-left, orange)
   - **Reset Balance** button (green)
   - **Play for Real** button (blue, redirects to `/test-player-login.html`)
   - Only visible in demo mode

## Environment Variables

Add these to your `infinity-storm-server/.env` file:

```bash
# Demo Mode Configuration
DEMO_JWT_SECRET=demo-secret-change-in-production-min-32-chars-long
DEMO_START_BALANCE=10000
DEMO_RTP_TARGET=3.0
DEMO_RM_TRIGGER_MULTIPLIER=3.0
DEMO_SCATTER_TRIGGER_MULTIPLIER=3.0
```

### Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_JWT_SECRET` | `demo-secret-change-in-production` | Secret for signing demo session JWTs. **Change in production!** |
| `DEMO_START_BALANCE` | `10000` | Starting virtual balance for demo players |
| `DEMO_RTP_TARGET` | `3.0` | RTP multiplier (3.0 = 300% RTP) |
| `DEMO_RM_TRIGGER_MULTIPLIER` | `3.0` | Random Multiplier trigger chance scalar |
| `DEMO_SCATTER_TRIGGER_MULTIPLIER` | `3.0` | Scatter/Free Spins trigger chance scalar |

## Testing Checklist

### Manual Testing

1. **Demo Mode Entry**
   - [ ] Open game without login → balance shows $10,000
   - [ ] DEMO badge visible (top-left)
   - [ ] Reset Balance and Play for Real buttons visible

2. **Demo Spins**
   - [ ] Spin works without authentication
   - [ ] Balance updates after each spin
   - [ ] Wins feel frequent (boosted RTP)
   - [ ] Random Multipliers trigger often
   - [ ] Free Spins (4+ scatters) trigger often

3. **Demo Balance Management**
   - [ ] Balance persists across page refreshes (cookie)
   - [ ] Reset Balance button restores to $10,000
   - [ ] Spinning below bet amount shows "Insufficient Balance" error

4. **Upgrade to Real Money**
   - [ ] Click "Play for Real" → redirects to login page
   - [ ] After login → returns to game
   - [ ] DEMO UI now hidden
   - [ ] Spins use real `/api/spin` endpoint
   - [ ] Spins recorded in `spin_results` table

5. **Database Isolation**
   - [ ] Check Supabase `spin_results` table → no demo spins recorded
   - [ ] Check `transactions` table → no demo transactions
   - [ ] Real player spins still recorded correctly

### Automated Testing

See `infinity-storm-server/tests/demo/` for:
- Demo cookie lifecycle tests
- Zero persistence validation
- RTP validation (demo vs. real)
- Math profile isolation tests

## Security Considerations

1. **Cookie Tampering**
   - Demo session JWT is signed with `DEMO_JWT_SECRET`
   - Balance cannot be manipulated by client
   - Server ignores any client-provided balance values

2. **Demo Math Isolation**
   - Demo engine instantiated separately: `new GameEngine({ mode: 'demo' })`
   - Real endpoint (`/api/spin`) never uses demo math
   - Mode guard logs and validates on every spin

3. **Rate Limiting**
   - Demo spins still subject to `demoSpinRateLimiter`
   - Default: 5000 requests/minute in dev, 30 requests/minute in production
   - Adjust in `infinity-storm-server/src/middleware/security.js`

4. **CORS**
   - Demo endpoints open but limited to `ALLOWED_ORIGINS` in `.env`
   - Production: restrict to your game provider domains only

## Rollout Plan

1. **Pre-Deployment**
   - [ ] Set `DEMO_JWT_SECRET` to strong random value in production `.env`
   - [ ] Review `ALLOWED_ORIGINS` for CORS
   - [ ] Test demo mode on staging
   - [ ] Verify no demo spins in production DB

2. **Deployment**
   - [ ] Deploy server with demo endpoints
   - [ ] Deploy client with demo UI
   - [ ] Monitor server logs for demo mode activation
   - [ ] Monitor rate limiter metrics

3. **Post-Deployment**
   - [ ] Run RTP validation tests (see `DEMO_MODE.md` testing section)
   - [ ] Check that real player flow unaffected
   - [ ] Verify demo → real upgrade path works

## Troubleshooting

### Demo balance not persisting
- Check browser cookies: look for `demo_session` httpOnly cookie
- Verify `DEMO_JWT_SECRET` is set in server `.env`
- Check server logs for JWT validation errors

### Demo UI not showing
- Confirm no auth token in `localStorage` (`infinity_storm_token`)
- Check `NetworkService.isDemoMode()` returns `true`
- Verify `createDemoModeUI` is called in `UIManager.createUI()`

### Demo spins appear in database
- Check server logs: should see `[DemoSpin]` prefix, not `[GameController]`
- Verify `/api/demo-spin` endpoint is being called (not `/api/spin`)
- Confirm `saveSpinResult` is NOT called in demo-spin route handler

### RTP not boosted
- Check `DEMO_RTP_TARGET` in `.env` (should be `3.0`)
- Verify demo engine: logs should show `[GameEngine] DEMO MODE ENABLED - RTP: 3`
- Check symbol weights in `profileDemo.js` (higher values = more wins)

### "Play for Real" button not working
- Update `playRealButton.on('pointerdown')` URL in `UIManager.js`
- In production, redirect to your provider's login page
- In development, use `/test-player-login.html`

## Future Enhancements

- [ ] Persistent demo leaderboards (cookie-based, no DB)
- [ ] "Share your big win" screenshot feature
- [ ] Demo mode analytics (track conversion to real play)
- [ ] Time-limited demo bonuses (e.g., "50 free spins for first 100 players")
- [ ] A/B test different demo RTP values

## Support

For questions or issues with demo mode implementation:
1. Check server logs: `[DemoSpin]`, `[DemoSession]`, `[GameEngine]` prefixes
2. Review this documentation
3. Contact development team

---

**Last Updated:** 2025-01-21  
**Version:** 1.0

