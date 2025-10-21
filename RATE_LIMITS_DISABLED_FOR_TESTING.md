# Rate Limits Disabled for Testing

**Date:** October 19, 2025  
**Environment:** Development  
**File Modified:** `infinity-storm-server/src/middleware/security.js`

## Summary

Rate limiting has been **effectively disabled** in development mode to allow high-frequency testing without hitting rate limit errors.

---

## Changes Made

### 1. Global Rate Limiter
**Before:** 1,000 requests per 15 minutes (dev mode)  
**After:** 10,000 requests per 15 minutes + **SKIPPED in development**

```javascript
// Line 191-194
skip: (req) => {
  // Skip rate limiting for health checks and in development mode
  if (IS_DEVELOPMENT) return true;
  return req.path === '/health' || req.path === '/api/health';
}
```

### 2. API Rate Limiter
**Before:** 100 requests per minute (dev mode)  
**After:** 1,000 requests per minute + **SKIPPED in development**

```javascript
// Line 226
skip: (req) => IS_DEVELOPMENT, // Skip API rate limiting in development
```

### 3. Spin Rate Limiter
**Before:** 100 spins per minute (dev mode)  
**After:** 1,000 spins per minute + **SKIPPED in development**

```javascript
// Line 248-252
skip: (req) => {
  // Skip in development mode or for demo spins
  if (IS_DEVELOPMENT) return true;
  return req.path.includes('/demo-spin');
}
```

### 4. Demo Spin Rate Limiter
**Before:** 200 demo spins per minute (dev mode)  
**After:** 5,000 demo spins per minute + **SKIPPED in development**

```javascript
// Line 267
skip: (req) => IS_DEVELOPMENT, // Skip demo rate limiting in development
```

---

## Current Rate Limits

### Development Mode (`NODE_ENV=development`)
| Limiter | Status | Limit |
|---------|--------|-------|
| Global | **DISABLED** | ∞ (effectively unlimited) |
| API | **DISABLED** | ∞ (effectively unlimited) |
| Spin | **DISABLED** | ∞ (effectively unlimited) |
| Demo Spin | **DISABLED** | ∞ (effectively unlimited) |
| Auth | **ENABLED** | 5 attempts per 15 min (security) |

### Production Mode (`NODE_ENV=production`)
| Limiter | Status | Limit |
|---------|--------|-------|
| Global | ENABLED | 100 requests per 15 min |
| API | ENABLED | 10 requests per minute |
| Spin | ENABLED | 10 spins per minute |
| Demo Spin | ENABLED | 30 spins per minute |
| Auth | ENABLED | 5 attempts per 15 min |

---

## How It Works

The rate limiters now check `IS_DEVELOPMENT` (which is `true` when `NODE_ENV=development`) and return `true` from the `skip` function, which tells express-rate-limit to skip rate limiting entirely for those requests.

```javascript
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// In each rate limiter:
skip: (req) => IS_DEVELOPMENT  // Bypasses rate limiting completely
```

---

## Testing

You can now:

✅ Make unlimited rapid requests to the server  
✅ Spam the spin button for testing  
✅ Test high-frequency scenarios without delays  
✅ Run automated test suites without rate limit errors  

**Note:** Authentication rate limiting is still active (5 attempts per 15 min) to prevent accidental lockouts even in development.

---

## Verification

Test the server is working:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
# Should return: HTTP 200 OK
```

---

## Production Safety

🔒 **Important:** These changes only affect development mode. Production rate limits remain strict and secure:

- Global: 100 requests per 15 minutes
- API: 10 requests per minute  
- Spins: 10 per minute
- Demo Spins: 30 per minute

The `IS_PRODUCTION` check ensures security is maintained in production environments.

---

## Reverting Changes

To re-enable rate limits in development (not recommended for testing):

1. Remove the `skip` functions or change them to:
```javascript
skip: (req) => false
```

2. Restart the server

---

## Server Status

✅ **Server Running:** `http://localhost:3000`  
✅ **Rate Limits:** Disabled in development  
✅ **Redis:** Fallback mode (SKIP_REDIS=true)  
✅ **Database:** PostgreSQL via Supabase (port 54322)  

**You can now test at high frequency without rate limit errors!**

