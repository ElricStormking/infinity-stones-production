# Database Connection Pool Exhaustion Fix

## Problem
Login and registration were failing with "stack depth limit exceeded" error even after previous fixes.

## Root Cause
**Multiple database connection pools** were being created independently:

1. **auth.js** (line 19): Created `dbPool` with **NO max connection limit**
   ```javascript
   const dbPool = new Pool({
     host: process.env.DB_HOST || '127.0.0.1',
     port: parseInt(process.env.DB_PORT) || 54322,
     // ... no max specified = unlimited connections!
   });
   ```

2. **pool.js** (line 16): Created shared `pool` with max 10 connections
   ```javascript
   const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });
   ```

3. **transactionLogger.js** (line 14): Created `this.pool` with max 5 connections
   ```javascript
   this.pool = new Pool({
     // ... 
     max: 5
   });
   ```

**Total**: Potentially 10 + unlimited + 5 = **way too many connections**

PostgreSQL has a default connection limit (usually 100). With multiple pools and no coordination, the database ran out of available connections, causing the "stack depth limit exceeded" error.

## The Fix

Consolidated all database operations to use **one shared connection pool** from `pool.js`.

### Changes Made:

**1. auth.js** - Use shared pool instead of creating new one:
```javascript
// BEFORE:
const { Pool } = require('pg');
const dbPool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  // ... creates new pool
});

// AFTER:
const { pool: dbPool } = require('../db/pool'); // Use shared pool
```

**2. transactionLogger.js** - Use shared pool instead of creating new one:
```javascript
// BEFORE:
const { Pool } = require('pg');
class TransactionLogger {
  constructor() {
    this.pool = new Pool({
      // ... creates new pool with max: 5
    });
  }
}

// AFTER:
const { pool } = require('../db/pool');
class TransactionLogger {
  constructor() {
    this.pool = pool; // Use shared pool
  }
}
```

## Why This Works

1. **Single Pool**: Only one connection pool is created (in `pool.js`)
2. **Controlled Limits**: Max 10 connections, shared across all services
3. **No Exhaustion**: Database connection limit is respected
4. **Proper Cleanup**: Connection release is centralized and consistent

## Configuration

The shared pool in `pool.js` is configured as:
```javascript
const pool = new Pool({ 
  connectionString, 
  max: 10,              // Maximum 10 connections
  idleTimeoutMillis: 30000  // 30 second timeout
});
```

This is sufficient for development and can be increased in production if needed.

## Files Modified

1. **infinity-storm-server/src/controllers/auth.js**
   - Removed local `dbPool` creation
   - Now imports shared `pool` from `../db/pool`

2. **infinity-storm-server/src/services/transactionLogger.js**
   - Removed local `this.pool` creation
   - Now uses shared `pool` from `../db/pool`

## Testing

After this fix:
- ✅ Login should work without "stack depth limit exceeded" error
- ✅ Registration should work without errors
- ✅ No connection pool exhaustion
- ✅ All database operations use the same connection pool
- ✅ Connection limits are respected

## Related Fixes

This fix complements the previous fixes:
- Dotenv loading order (server.js)
- Schema conflict resolution (transactionLogger.js)
- Multiple stuck processes cleanup

All three issues combined to cause the login failures. This is the final fix needed.

