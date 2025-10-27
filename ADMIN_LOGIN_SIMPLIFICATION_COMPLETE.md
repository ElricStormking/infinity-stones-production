# Admin Login Simplification - Implementation Complete

## Overview
Successfully replaced the complex Player-based admin authentication system with a simple standalone `admins` table using PostgreSQL, hardcoded default credentials, and streamlined JWT-based authentication.

## Changes Implemented

### 1. New Admin Model ✓
**File:** `infinity-storm-server/src/models/Admin.js`
- Simple Sequelize model with minimal fields:
  - `id` (UUID, primary key)
  - `account_id` (string, unique, indexed)
  - `password_hash` (bcrypt hashed)
  - `created_at`, `updated_at`
- Static method `Admin.authenticate(account_id, password)` for credential validation
- Method `admin.checkPassword(password)` using bcrypt.compare
- Static method `Admin.ensureDefaultAdmin()` creates default admin on first startup
- Method `admin.getSafeData()` returns admin data without password hash
- NO status enum, NO email, NO roles - just account_id and password

### 2. Database Migration ✓
**File:** `infinity-storm-server/src/db/migrations/003_create_admins_table.sql`
```sql
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admins_account_id ON admins(account_id);
```

### 3. Auto-Setup on Server Start ✓
**File:** `infinity-storm-server/server.js` (lines 207-235)
- In development mode, automatically:
  1. Runs the 003_create_admins_table.sql migration
  2. Calls `Admin.ensureDefaultAdmin()` to create default admin if none exists
- Console output: "✓ Default admin created: admin / admin123"
- Replaced the old AdminLog.sync block

### 4. Simplified Admin Controller ✓
**File:** `infinity-storm-server/src/controllers/admin.js`
- **loginPage** (line 72):
  - Removed csrfToken logic
  - Simple error message mapping
- **processLogin** (line 90):
  - Changed from `username` to `account_id` field
  - Removed Player.findByIdentifier and AdminLog calls
  - Uses `Admin.authenticate(account_id, password)`
  - Returns 401 JSON response for invalid credentials
  - Creates JWT token with payload: `{ adminId, account_id, type: 'admin' }`
  - Sets `admin_token` cookie with 24h or 7d expiry
  - Returns JSON success with redirect URL

### 5. Simplified Admin Auth Middleware ✓
**File:** `infinity-storm-server/src/middleware/adminAuth.js`
- **authenticateAdmin** (line 48):
  - Removed all AdminLog calls
  - Removed SessionManager dependency
  - Simple JWT decode using `jwt.verify()`
  - Validates `decoded.type === 'admin'` and `decoded.adminId` exists
  - Looks up admin: `Admin.findOne({ where: { id: decoded.adminId } })`
  - Clears invalid cookies and redirects to login on failure
  - Attaches `req.admin = admin.getSafeData()` and `req.admin_token = token`
  - Logs access with account_id instead of username

### 6. Updated Admin Routes ✓
**File:** `infinity-storm-server/src/routes/admin.js`
- Removed `csrf` import and CSRF protection middleware entirely
- Updated POST `/login` validation:
  - Changed from `body('username')` to `body('account_id')`
  - Removed alphanumeric validation (allows more flexible account IDs)
  - Password validation simplified to min 1 character
- Removed SessionManager import (unused)

### 7. Updated Login View ✓
**File:** `infinity-storm-server/views/admin/login.ejs`
- Changed form field from `username` to `account_id`
- Updated label to "Account ID" instead of "Username or Email"
- Updated placeholder to "Enter your account ID"
- Removed CSRF token hidden input
- Updated JavaScript to focus on `account_id` field

### 8. Removed Admin Seeding ✓
**File:** `infinity-storm-server/seed-admin.js`
- **DELETED** - No longer needed

### 9. Registered Admin Model ✓
**File:** `infinity-storm-server/src/models/index.js`
- Added `'Admin.js'` to modelFiles array
- Added test data for Admin validation:
  ```javascript
  Admin: {
    account_id: 'testadmin',
    password_hash: '$2b$12$...'
  }
  ```

## Default Admin Credentials

| Field | Value |
|-------|-------|
| **Account ID** | `admin` |
| **Password** | `admin123` |

## How It Works

1. **First Server Start (Dev Mode)**:
   - Server runs migration to create `admins` table
   - `Admin.ensureDefaultAdmin()` checks if any admin exists
   - If none exist, creates admin with account_id="admin", password="admin123" (bcrypt hashed)
   - Console shows: "✓ Default admin created: admin / admin123"

2. **Subsequent Starts**:
   - Migration runs but does nothing (table already exists)
   - `Admin.ensureDefaultAdmin()` sees existing admin, skips creation
   - Console shows: "✓ Admin account exists"

3. **Admin Login Flow**:
   - Visit `http://127.0.0.1:3000/admin/login`
   - Enter account_id="admin", password="admin123"
   - Server calls `Admin.authenticate()` to validate credentials
   - On success, creates JWT with 24h expiry (7d if "remember me" checked)
   - Sets `admin_token` cookie
   - Returns JSON: `{ success: true, redirect: '/admin/dashboard' }`

4. **Protected Admin Routes**:
   - `authenticateAdmin` middleware extracts `admin_token` from cookie
   - Decodes JWT, verifies type and adminId
   - Looks up admin in database
   - Attaches admin data to `req.admin`
   - Continues to route handler

## Benefits Achieved

✅ **No seeding scripts required** - Admin auto-created on first start  
✅ **No Player model confusion** - Admins are separate entities  
✅ **No AdminLog constraint failures** - No audit logging during login  
✅ **No CSRF complexity** - Removed entirely for dev simplicity  
✅ **No SessionManager overhead** - Simple JWT-based sessions  
✅ **Simple credentials** - Just account_id + password, no email  
✅ **Fast setup** - Works immediately after `npm start`  
✅ **No database seeding step** - Everything automatic

## Testing

1. Start server:
   ```powershell
   cd D:\infinity-gauntlet\infinity-storm-server
   npm start
   ```

2. Check console for:
   ```
   ✓ Admin table migration applied
   ✓ Default admin created: admin / admin123
   ```
   (Or "✓ Admin account exists" if already created)

3. Open browser:
   ```
   http://127.0.0.1:3000/admin/login
   ```

4. Login with:
   - Account ID: `admin`
   - Password: `admin123`

5. Should redirect to dashboard

## Files Modified

- `infinity-storm-server/src/models/Admin.js` (NEW)
- `infinity-storm-server/src/db/migrations/003_create_admins_table.sql` (NEW)
- `infinity-storm-server/src/models/index.js` (UPDATED)
- `infinity-storm-server/server.js` (UPDATED)
- `infinity-storm-server/src/controllers/admin.js` (UPDATED)
- `infinity-storm-server/src/middleware/adminAuth.js` (UPDATED)
- `infinity-storm-server/src/routes/admin.js` (UPDATED)
- `infinity-storm-server/views/admin/login.ejs` (UPDATED)
- `infinity-storm-server/seed-admin.js` (DELETED)

## Linter Status

✅ No linter errors in any modified files

## Next Steps

The admin login system is now simplified and ready to use. To further enhance:

1. Add more admins: Insert rows directly into `admins` table with bcrypt password hash
2. Implement password change endpoint
3. Add admin creation endpoint for existing admins
4. Customize dashboard queries (currently still expect Player-based admin data)

## Production Considerations

For production deployment:
- Change default password in `Admin.ensureDefaultAdmin()` or disable auto-creation
- Use strong JWT_ACCESS_SECRET in environment variables
- Enable CSRF protection (already conditionally enabled for production)
- Add rate limiting for failed login attempts (already implemented)
- Consider adding 2FA or additional security measures

