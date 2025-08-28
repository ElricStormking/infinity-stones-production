# JWT Authentication System Implementation

## Overview

Implemented a comprehensive JWT authentication system for the Infinity Storm game server following a portal-first architecture where the web portal handles login/registration and the game server validates pre-authenticated sessions.

## Architecture

### Portal-First Design
- **Web Portal**: Handles user login, registration, and initial authentication
- **Game Server**: Validates JWT tokens issued by the portal
- **Session Management**: Redis + PostgreSQL for fast access and persistence
- **Single Active Session**: Enforced per player with automatic cleanup

## Components Implemented

### 1. JWT Utilities (`src/auth/jwt.js`)
- **Token Verification**: Validates access and refresh tokens
- **Token Generation**: Creates new tokens (for portal use)
- **Session Storage**: Redis-based session caching with automatic expiry
- **Blacklisting**: Prevents reuse of invalidated tokens
- **Activity Tracking**: Updates session activity timestamps
- **Session Refresh**: Extends expiry times when needed

### 2. Session Manager (`src/auth/sessionManager.js`)
- **Dual Storage**: Redis (fast) + PostgreSQL (persistent)
- **Session Creation**: Creates new authenticated sessions
- **Session Validation**: Validates tokens with comprehensive checks
- **Session Recovery**: Handles disconnection and reconnection
- **Credit Management**: Integrates with player credit system
- **Admin Functions**: Force logout, session stats, cleanup

### 3. Authentication Middleware (`src/middleware/auth.js`)
- **authenticate**: Protects endpoints requiring authentication
- **optionalAuth**: Attaches user data if token is present
- **requireAdmin**: Admin-only endpoint protection
- **blockDemoMode**: Prevents certain actions in demo mode
- **requireActivePlayer**: Ensures account is not suspended/banned
- **checkSessionRefresh**: Auto-refresh for expiring sessions

### 4. Auth Controller (`src/controllers/auth.js`)
- **Session Validation**: `POST /api/auth/validate`
- **Session Creation**: `POST /api/auth/session`
- **Session Refresh**: `POST /api/auth/refresh`
- **Logout**: `POST /api/auth/logout`
- **Session Info**: `GET /api/auth/session`
- **Auth Status**: `GET /api/auth/status`
- **Admin Endpoints**: Session management and statistics

### 5. Auth Routes (`src/routes/auth.js`)
- **Public Endpoints**: Validation, session creation, status check
- **Protected Endpoints**: Session info, logout
- **Admin Endpoints**: Force logout, active sessions, statistics
- **Input Validation**: Express-validator integration
- **Rate Limiting**: Protection against abuse
- **Error Handling**: Structured error responses

## Security Features

### Token Security
- **JWT Signature Verification**: RSA/HMAC token validation
- **Token Expiration**: 30-minute access tokens, 7-day refresh tokens
- **Token Blacklisting**: Prevents reuse of logged-out tokens
- **Token Hashing**: SHA-256 hashes for Redis storage

### Session Management
- **Single Active Session**: One session per player
- **Automatic Cleanup**: Expired session removal
- **Activity Tracking**: Last activity timestamps
- **IP/User-Agent Logging**: Device tracking for security
- **Session Recovery**: Handles network disconnections

### Middleware Protection
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Request sanitization
- **Error Handling**: Secure error responses

## Database Integration

### Redis Session Cache
```javascript
// Session storage format
game:session:{playerId} = {
    token_hash: "sha256_hash",
    player: { id, username, email, ... },
    created_at: "ISO_timestamp",
    last_activity: "ISO_timestamp",
    expires_at: "ISO_timestamp",
    ip_address: "client_ip",
    user_agent: "browser_info"
}
```

### PostgreSQL Persistence
- **Sessions Table**: Persistent session records
- **Players Table**: Player accounts and credits
- **Audit Trail**: Login/logout tracking
- **Admin Logs**: Administrative actions

## API Endpoints

### Public Endpoints
- `POST /api/auth/validate` - Validate existing token
- `POST /api/auth/session` - Create session from portal token
- `POST /api/auth/refresh` - Refresh session with new token
- `GET /api/auth/status` - Check authentication status

### Protected Endpoints
- `POST /api/auth/logout` - End current session
- `GET /api/auth/session` - Get session information

### Admin Endpoints
- `GET /api/auth/admin/sessions` - List all active sessions
- `POST /api/auth/admin/force-logout` - Force logout a player
- `GET /api/auth/admin/stats` - Session statistics
- `POST /api/auth/admin/cleanup` - Clean expired sessions

## Game Integration

### Protected Game Endpoints
- `/api/spin` now requires authentication
- Player data attached to requests via `req.user`
- Session info available via `req.session_info`
- Credit validation before spins
- Automatic credit updates for wins

### WebSocket Authentication
- Future: Socket.io authentication middleware
- Session validation for real-time features
- Player identification for multiplayer features

## Configuration

### Environment Variables
```env
JWT_ACCESS_SECRET=your-super-secret-access-token-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-min-32-chars
JWT_ACCESS_EXPIRY=30m
JWT_REFRESH_EXPIRY=7d
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Session Timeouts
- **Access Token**: 30 minutes
- **Refresh Token**: 7 days
- **Session Inactivity**: 30 minutes
- **Auto-refresh**: When < 5 minutes remaining

## Testing

### Test Coverage
- Authentication endpoint tests
- JWT utility tests
- Middleware protection tests
- Session management tests
- Error handling tests

### Test Files
- `tests/auth/AuthEndpoints.test.js` - API endpoint tests
- Test integration with existing cascade tests

## Usage Examples

### Client Authentication Flow
```javascript
// 1. Validate token from portal
const response = await fetch('/api/auth/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: portalToken })
});

// 2. Create game session
const sessionResponse = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        token: portalToken,
        ip_address: clientIP,
        user_agent: navigator.userAgent
    })
});

// 3. Use token for game requests
const spinResponse = await fetch('/api/spin', {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${portalToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bet: 1.00 })
});
```

### Admin Functions
```javascript
// Force logout a player (admin only)
const logoutResponse = await fetch('/api/auth/admin/force-logout', {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
        player_id: 'uuid',
        reason: 'Account verification required'
    })
});
```

## Next Steps

1. **Portal Integration**: Connect with web portal authentication
2. **WebSocket Authentication**: Add socket.io authentication
3. **Rate Limiting**: Fine-tune rate limits per endpoint
4. **Monitoring**: Add authentication metrics and alerts
5. **Testing**: Expand test coverage and integration tests

## Security Considerations

- **Secret Management**: Use secure secret generation and storage
- **HTTPS**: Always use HTTPS in production
- **Token Rotation**: Regular refresh token rotation
- **Audit Logging**: Track all authentication events
- **Account Lockout**: Implement brute force protection
- **Session Monitoring**: Monitor for suspicious activity

This authentication system provides casino-grade security for the Infinity Storm game server while maintaining the portal-first architecture and supporting session recovery, automatic refresh, and comprehensive admin controls.