# Client-Server Conversion Requirements

## Overview
Transform Infinity Storm from a vulnerable client-only casino game to a secure client-server architecture where all critical game logic, RNG, and payout calculations execute on the server.

## User Stories & Acceptance Criteria

### 1. Player Authentication & Session Management

**US-1.1: Player Login**
- **WHEN** a player provides valid credentials
- **THEN** the system SHALL authenticate the player against the database
- **AND** the system SHALL issue a JWT token with 30-minute idle timeout
- **AND** the system SHALL create a new session record
- **AND** the system SHALL refresh token on activity

**US-1.2: Session Validation**
- **WHILE** a player has an active session
- **IF** the session token expires or becomes invalid
- **THEN** the system SHALL redirect to login
- **AND** the system SHALL preserve the current game state for recovery

**US-1.3: Concurrent Session Prevention**
- **WHEN** a player attempts to login from a second device
- **THEN** the system SHALL prevent the second login
- **AND** the system SHALL display message "Active session exists on another device"

### 2. Server-Authoritative Game Engine

**US-2.1: Spin Request Processing**
- **WHEN** a player initiates a spin with valid bet amount ($0.40-$2000)
- **THEN** the server SHALL validate the player's credit balance >= bet amount
- **AND** the server SHALL deduct the bet from player credits atomically
- **AND** the server SHALL generate the complete spin result server-side

**US-2.2: Random Number Generation**
- **WHERE** random numbers are required for gameplay
- **THEN** the system SHALL use cryptographically secure RNG (crypto.randomBytes)
- **AND** the system SHALL seed the RNG per player session
- **AND** the system SHALL log all RNG calls for audit purposes

**US-2.3: Grid Generation**
- **WHEN** generating a new grid (initial or cascade)
- **THEN** the server SHALL determine all symbol positions
- **AND** the server SHALL use weighted probability tables from GameConfig
- **AND** the server SHALL ensure RTP targets are maintained

**US-2.4: Win Calculation**
- **WHEN** evaluating a grid for wins
- **THEN** the server SHALL identify all clusters of 8+ matching symbols
- **AND** the server SHALL calculate payouts using the exact payout table
- **AND** the server SHALL apply any active multipliers correctly
- **AND** the server SHALL return itemized win details for each cluster

**US-2.5: Cascade Simulation**
- **WHEN** symbols are removed from winning clusters
- **THEN** the server SHALL simulate gravity-based cascading
- **AND** the server SHALL generate new symbols to fill empty positions
- **AND** the server SHALL recursively check for new wins
- **UNTIL** no new winning clusters are formed

### 3. Special Features Server Logic

**US-3.1: Free Spins Trigger**
- **WHEN** 4+ scatter symbols appear on the grid
- **THEN** the server SHALL award 15 free spins
- **AND** the server SHALL track free spins state in the database
- **AND** the server SHALL apply accumulating multipliers during free spins

**US-3.2: Random Multiplier Feature**
- **WHEN** the random multiplier feature triggers (server-determined)
- **THEN** the server SHALL select 1-3 random positions
- **AND** the server SHALL assign multipliers (2x-500x) to those positions
- **AND** the server SHALL include multiplier data in the spin response

**US-3.3: Free Spins Purchase**
- **WHEN** a player purchases free spins (40x-100x bet)
- **THEN** the server SHALL validate sufficient balance
- **AND** the server SHALL deduct the purchase cost atomically
- **AND** the server SHALL immediately trigger free spins mode

### 4. Client-Server Communication

**US-4.1: Spin Request API**
- **WHEN** the client sends a spin request
- **THEN** the request SHALL include: sessionId, betAmount, timestamp
- **AND** the server SHALL respond with complete spin data within 500ms
- **AND** the response SHALL include all cascade sequences and final state

**US-4.2: Real-time Updates**
- **WHILE** a spin is processing
- **IF** WebSocket connection is available
- **THEN** the server SHALL emit progress events for long cascades
- **OTHERWISE** the server SHALL return complete results via HTTP

**US-4.3: Network Resilience**
- **IF** network connection is lost during a spin
- **THEN** the server SHALL complete and store the spin result
- **AND** the client SHALL retrieve the result upon reconnection
- **AND** the client SHALL resume animation from the interruption point

### 5. Database & Transaction Management

**US-5.1: Atomic Credit Updates**
- **WHEN** updating player credits (bet deduction or win credit)
- **THEN** the system SHALL use database transactions
- **AND** the system SHALL prevent race conditions
- **AND** the system SHALL maintain an audit trail
- **AND** the system SHALL track credits as platform currency (not dollars)

**US-5.2: Spin History Recording**
- **FOR** every spin executed
- **THEN** the system SHALL record: timestamp, bet, result grid, cascades, total win
- **AND** the system SHALL link the record to player and session
- **AND** the system SHALL retain records for regulatory compliance (2+ years)
- **AND** the system SHALL support paginated retrieval (100 records per page)

**US-5.3: Transaction Logging**
- **FOR** every financial transaction
- **THEN** the system SHALL create an immutable transaction record
- **AND** the system SHALL include: type, amount, balance before/after, reference

### 6. Security & Anti-Cheat

**US-6.1: Request Validation**
- **FOR** every API request
- **THEN** the server SHALL validate JWT token authenticity
- **AND** the server SHALL verify request parameters
- **AND** the server SHALL check rate limits (max 1 spin per 500ms)

**US-6.2: Client State Verification**
- **WHEN** the client reports its state
- **THEN** the server SHALL ignore client-reported game outcomes
- **AND** the server SHALL use only server-calculated results
- **AND** the server SHALL detect state tampering attempts

**US-6.3: Audit Trail**
- **FOR** all game actions and system events
- **THEN** the system SHALL create timestamped log entries
- **AND** the system SHALL include: player ID, action, IP address, result
- **AND** the system SHALL store logs in tamper-proof format

### 7. Client Refactoring

**US-7.1: Display-Only Client**
- **WHERE** the client previously calculated game logic
- **THEN** the client SHALL only display server-provided results
- **AND** the client SHALL maintain smooth animations
- **AND** the client SHALL preserve the exact current user experience

**US-7.2: API Integration**
- **WHEN** the client needs game data
- **THEN** the client SHALL request it from server APIs
- **AND** the client SHALL handle loading states
- **AND** the client SHALL display appropriate error messages

### 8. Performance Requirements

**US-8.1: Response Time**
- **FOR** spin requests under normal load
- **THEN** the server SHALL respond within 500ms (p95)
- **AND** the server SHALL handle 100 concurrent players
- **AND** the server SHALL maintain <100ms database query time

**US-8.2: Availability**
- **DURING** normal operations
- **THEN** the system SHALL maintain 99.9% uptime
- **AND** the system SHALL handle graceful degradation
- **AND** the system SHALL provide health check endpoints

### 9. Player History & Replay

**US-9.1: Spin History Display**
- **WHEN** a player requests their spin history
- **THEN** the system SHALL display the most recent 100 spins
- **AND** the system SHALL show: timestamp, bet amount, win amount, multipliers
- **AND** the system SHALL provide "Show Next 100" button for pagination
- **AND** the system SHALL load next batch without page refresh

**US-9.2: Replay Functionality**
- **WHEN** a player selects a historical spin to replay
- **THEN** the system SHALL retrieve the complete spin data
- **AND** the system SHALL replay all cascades and animations
- **AND** the system SHALL display original win calculations

### 10. Admin Panel

**US-10.1: Admin Authentication**
- **WHEN** an admin user logs in with valid credentials
- **THEN** the system SHALL verify admin role in database
- **AND** the system SHALL provide access to admin dashboard
- **AND** the system SHALL log all admin actions

**US-10.2: Player Management**
- **WHEN** viewing the admin panel
- **THEN** admins SHALL see list of all players
- **AND** admins SHALL view player details: credits, session status, recent activity
- **AND** admins SHALL be able to adjust player credits with reason logging

**US-10.3: Game Monitoring**
- **WHEN** accessing game statistics
- **THEN** admins SHALL view real-time RTP metrics
- **AND** admins SHALL see active sessions count
- **AND** admins SHALL monitor system health and performance

**US-10.4: Transaction Audit**
- **WHEN** reviewing transactions
- **THEN** admins SHALL search by player, date range, or transaction type
- **AND** admins SHALL export transaction reports
- **AND** admins SHALL view detailed spin results with RNG seeds

### 11. Environment Management

**US-11.1: Docker Development Environment**
- **WHEN** setting up local development
- **THEN** Docker Compose SHALL spin up all required services
- **AND** the system SHALL include local Supabase instance
- **AND** the system SHALL seed test data automatically

**US-11.2: Staging Environment**
- **WHEN** deploying to staging
- **THEN** the system SHALL use separate database and configs
- **AND** the system SHALL allow testing without affecting production
- **AND** the system SHALL support easy data reset

### 12. Compliance & RTP

**US-12.1: RTP Verification**
- **OVER** a large sample of spins (1M+)
- **THEN** the system SHALL achieve 96.5% RTP (±0.5%)
- **AND** the system SHALL log RTP metrics continuously
- **AND** the system SHALL alert on significant deviations

**US-12.2: Regulatory Compliance**
- **FOR** all game operations
- **THEN** the system SHALL maintain compliant audit logs
- **AND** the system SHALL support regulatory reporting

## Non-Functional Requirements

### NFR-1: Technology Stack
- Node.js + Express for server
- Supabase (local Docker) for development
- PostgreSQL for production database
- Docker + Docker Compose for containerization
- JWT for authentication with 30-minute idle timeout
- Socket.io for real-time communication
- Maintain existing Phaser 3 client with window global pattern
- Platform credits system (not dollar-based)

### NFR-2: Development Constraints
- All server code in ./infinity-storm-server directory
- Maintain backward compatibility during migration
- Support feature flags for gradual rollout
- Preserve exact game mechanics and RTP

### NFR-3: Security Standards
- HTTPS/WSS for all communication
- Bcrypt for password hashing
- Environment variables for secrets
- Rate limiting on all endpoints
- Input sanitization and validation

## Acceptance Testing Criteria

1. **Security Testing**: Attempt client-side manipulation; verify server rejects
2. **RTP Testing**: Run 1M simulated spins; verify 96.5% ±0.5% RTP
3. **Performance Testing**: Load test with 100 concurrent players
4. **Recovery Testing**: Interrupt connections mid-spin; verify recovery
5. **Compliance Testing**: Verify audit trail completeness and accuracy

## Clarified Requirements

1. **Betting Limits**: Maintain existing limits ($0.40-$2000)
2. **Session Timeout**: 30 minutes idle timeout with automatic token refresh
3. **Demo Mode**: Not required initially, database schema should support future addition
4. **Currency System**: Platform special credits only, no dollar conversion
5. **Concurrent Games**: One active session per player only
6. **Spin History**: Display 100 records at once with "Show Next 100" pagination
7. **Progressive Jackpots**: Design schema to support but don't implement yet
8. **Responsible Gaming**: Not required
9. **Admin Panel**: Basic admin panel for player and game management
10. **Environments**: Docker-based staging with local Supabase for testing

## Success Metrics

- Zero client-side game logic execution
- 100% of RNG on server
- All financial transactions atomic and audited
- Client cannot affect game outcomes
- Performance remains within specified limits
- RTP maintains 96.5% target
- Complete audit trail for compliance