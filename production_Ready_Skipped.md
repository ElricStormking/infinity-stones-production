Production-Readiness Items Temporarily Skipped (to enable spins during local testing)

This document lists every security/hardening feature we intentionally relaxed for local/dev so spins work reliably while we debug. Each item includes the current dev setting, where it lives in code/config, the target for production, and the action required to restore it.

1) HTTPS enforcement and HSTS
- Dev: HTTPS redirects are bypassed for loopback; HSTS disabled.
- Where: `infinity-storm-server/src/middleware/security.js` → `enforceHttps`, `securityHeaders` (Helmet config). `FORCE_HTTPS=false` in compose.
- Prod target: Force HTTPS everywhere; enable HSTS and CSP.
- Action: Set `FORCE_HTTPS=true`; keep loopback bypass only for strictly local builds; enable Helmet HSTS and CSP.

2) CORS loosened for local hosts
- Dev: Wide allowlist including `localhost`/`127.0.0.1`/test ports.
- Where: `security.js` → `ALLOWED_ORIGINS` and `corsOptions`.
- Prod target: Restrict to casino domains only.
- Action: Trim `ALLOWED_ORIGINS` to the production domains.

3) Rate limiting adjusted and bypassed for loopback; API limiter skips spin
- Dev: `globalRateLimiter`, `apiRateLimiter`, `spinRateLimiter`, `demoSpinRateLimiter` all skip loopback; `apiRateLimiter` explicitly bypasses `/api/spin` and `/api/demo-spin`; dedicated spin limiter is active but also skipped on loopback.
- Where: `security.js` and wiring in `server.js`.
- Prod target: No loopback bypass in production; keep strict per-IP and per-player limits; include `/api/spin` in API protections in addition to the dedicated limiter.
- Action: Remove loopback skips in prod; consider lower thresholds; keep separate spin limiter; re-enable WAF if applicable.

4) Demo endpoints and dev utilities exposed
- Dev: Enabled endpoints/tools:
  - `/api/demo-spin`
  - `/api/dev/wallet/balance`
  - `/portal/mock/*` (mock portal credit)
  - `/api/reset-game-state`
  - `/admin/api/metrics` (no auth in dev)
  - `test-player-login.html`
- Where: `server.js`, `src/routes/api.js`, `src/routes/portal.js`, project root HTML.
- Prod target: Disable or guard all demo/dev endpoints and test pages.
- Action: Wrap with `NODE_ENV !== 'production'` checks or remove from production image; block routes in `server.js`.

5) Admin security reduced for dev
- Dev: CSRF removed; simplified `adminAuth`; default admin auto-ensured (`admin/admin123`); audit logging toned down.
- Where: `src/routes/admin.js`, `src/middleware/adminAuth.js`, `src/controllers/admin.js`, migration/ensure on boot in `server.js`.
- Prod target: Re-enable CSRF, strong passwords/2FA/IP allowlist, robust audit logging; no default admin auto-create.
- Action: Restore CSRF middleware; reintroduce admin audit; disable `ensureDefaultAdmin()` in prod; enforce strong credential policies and login throttling.

6) Token handling relaxed for client convenience
- Dev: Token may be passed via URL param from `test-player-login.html`; long-lived tokens.
- Where: Client `NetworkService.js`/`SessionService.js` and login page; compose env.
- Prod target: Do not pass JWT in URL; use Authorization header or secure HttpOnly cookie; shorter access token TTL.
- Action: Remove URL-param token flow; set `JWT_ACCESS_EXPIRY` to a short window (e.g., 15m–30m) and keep refresh tokens; consider cookie-based session for the portal->game hop.

7) State validation and anti-cheat partially disabled
- Dev: `DISABLE_STATE_VALIDATION=true` fast-path; anti-cheat skipped when validation disabled; state update errors are caught and allowed to continue to avoid 500s.
- Where: `src/game/stateManager.js`, `src/controllers/game.js` (catch-and-continue around state updates).
- Prod target: Full state transition validation and anti-cheat checks must run; spins should fail on invalid state.
- Action: Set `DISABLE_STATE_VALIDATION=false` in prod; remove catch-and-continue path so invalid updates error out; keep audit logging.

8) RTP strictness relaxed in dev
- Dev: Strict RTP validation disabled for loopback/dev to prevent test 500s; demo engine has 300% RTP for free-play.
- Where: `src/controllers/game.js`, `src/game/gameEngineDemo.js`.
- Prod target: Keep normal engine only; enable RTP validation.
- Action: Ensure demo engine and RTP bypass are not available in prod.

9) Financial logging to Supabase disabled by default
- Dev: `ENABLE_SUPABASE_FINANCIAL_LOG=false` to avoid local row locks/timeouts.
- Where: `src/services/financialTransactionLogger.js`.
- Prod target: All financial balance changes are logged reliably.
- Action: Set `ENABLE_SUPABASE_FINANCIAL_LOG=true` in prod; monitor for failures.

10) Static asset caching disabled for fast iteration
- Dev: `express.static` serves with `maxAge: 0`, `etag: false` to avoid cache.
- Where: `server.js`.
- Prod target: Enable long-lived caching with hashed assets and ETag.
- Action: Restore cache headers; ensure fingerprinted builds.

11) Supabase Studio exposed for convenience
- Dev: Studio published on host port `54323`.
- Where: Local Docker run command for `supabase_studio_public_exposed`.
- Prod target: Do not expose Studio publicly.
- Action: Remove/lock Studio in prod; if needed, put behind VPN and SSO.

12) Database SSL and local-only settings
- Dev: `PGSSLMODE=disable` for local Supabase; DB host/IP is a LAN address.
- Where: `docker-compose.production.yml` env.
- Prod target: Enforce SSL/TLS to managed Postgres; rotate credentials; least-privilege users.
- Action: Set `PGSSLMODE=require` (or managed SSL); use cloud Supabase with SSL.

13) Auto-provisioning test players on login (non-production only)
- Dev: `AUTO_CREATE_TEST_PLAYERS=true` path creates accounts on-the-fly.
- Where: `src/controllers/auth.js` (login path).
- Prod target: No auto-create on login; proper registration only.
- Action: Ensure flag is `false` in prod; remove dev branch.

14) API payload limits and idempotency
- Dev: Spin idempotency keys are not yet enforced; request size limit is present but conservative.
- Where: `security.js` (`validateRequestSize`), spin controllers.
- Prod target: Enforce idempotency keys on `/api/spin` to prevent duplicate processing; keep size limits.
- Action: Add an idempotency key header/body with Redis-backed dedupe.

15) Health and metrics exposure
- Dev: Health endpoints bypass rate limits; dev metrics route exists.
- Where: `security.js` (rate-limit skips), `server.js` (`/admin/api/metrics`).
- Prod target: Keep health minimal; restrict metrics to authenticated/ops-only.
- Action: Remove unauthenticated metrics routes; keep rate limits enabled.

Environment flags to review for production
- `FORCE_HTTPS=true`
- `DISABLE_STATE_VALIDATION=false`
- `ENABLE_SUPABASE_FINANCIAL_LOG=true`
- `AUTO_CREATE_TEST_PLAYERS=false`
- `PGSSLMODE=require` (or managed SSL)
- `JWT_ACCESS_EXPIRY` short (e.g., `15m`); `JWT_REFRESH_EXPIRY` per policy
- Remove `supabase_studio_public_exposed` container; do not expose `54323`

Routing/features to disable in production builds
- `/api/demo-spin`, `/api/dev/wallet/balance`, `/portal/mock/*`, `/api/reset-game-state`, `/admin/api/metrics`, `test-player-login.html`.

Notes
- Redis sessions and JWT jti uniqueness are production-grade and should remain enabled.
- Loopback-specific bypasses are acceptable only for local testing; ensure build-time or runtime guards so they cannot be enabled in production by accident.


