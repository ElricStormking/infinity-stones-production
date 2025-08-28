# Infinity Storm Server

The server-side implementation of the Infinity Storm game with casino-grade security, RNG, and game logic.

## Architecture

This server follows a clean, modular architecture with the following key components:

### Directory Structure

```
infinity-storm-server/
├── src/
│   ├── auth/           # Authentication & JWT management
│   ├── config/         # Application configuration
│   ├── controllers/    # Express route controllers
│   ├── db/            # Database models and migrations
│   ├── game/          # Game engine and logic
│   ├── middleware/    # Express middleware
│   ├── models/        # Data models
│   ├── routes/        # Express route definitions
│   ├── services/      # Business logic services
│   ├── utils/         # Utility functions
│   └── websocket/     # WebSocket event handlers
├── game-logic/        # Core game logic (GridEngine)
├── scripts/          # Database and deployment scripts
├── tests/            # Test suites
├── docker/           # Docker configurations
├── supabase/         # Supabase configuration
└── logs/             # Application logs
```

### Key Features

- **Casino-Grade Security**: JWT authentication, rate limiting, input validation
- **Server-Side RNG**: Cryptographically secure random number generation
- **Complete Game Logic**: All game mechanics run server-side
- **Real-time Communication**: WebSocket support for live updates
- **Comprehensive Audit Trail**: All transactions and game actions logged
- **Docker Ready**: Full containerization with Docker Compose
- **Supabase Integration**: Local development with Supabase MCP

## Quick Start

### Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Local Database**
   ```bash
   npm run dev:db
   ```

4. **Run Migrations**
   ```bash
   npm run migrate
   ```

5. **Seed Database**
   ```bash
   npm run seed
   ```

6. **Start Development Server**
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run all tests
- `npm run test:cascade` - Run cascade-specific tests
- `npm run test:smoke` - Run smoke tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with test data
- `npm run dev:db` - Start local database with Docker
- `npm run dev:full` - Start both database and server

### Supabase Commands

- `npm run sb:start` - Start local Supabase instance
- `npm run sb:stop` - Stop local Supabase instance
- `npm run sb:status` - Check Supabase status
- `npm run sb:reset` - Reset Supabase database
- `npm run sb:verify` - Verify Supabase connection

## Configuration

### Environment Variables

Key configuration options (see `.env.example`):

- **Database**: `DATABASE_URL`, `DB_HOST`, `DB_PORT`
- **Redis**: `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`
- **Authentication**: `JWT_SECRET`, `SESSION_SECRET`
- **Game Settings**: `MIN_BET`, `MAX_BET`, `DEFAULT_CREDITS`
- **Security**: `BCRYPT_ROUNDS`, `RATE_LIMIT_MAX_REQUESTS`

### Docker Development

Start the complete development environment:

```bash
# Start all services (PostgreSQL, Redis, Game Server)
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Player login
- `POST /api/auth/logout` - Player logout
- `POST /api/auth/refresh` - Refresh JWT token

### Game
- `POST /api/game/spin` - Process game spin
- `GET /api/game/history` - Get spin history
- `GET /api/game/replay/:id` - Get spin replay data
- `POST /api/game/purchase-free-spins` - Purchase free spins

### Admin
- `GET /api/admin/players` - List players
- `POST /api/admin/adjust-credits` - Adjust player credits
- `GET /api/admin/metrics` - System metrics
- `GET /api/admin/transactions` - Transaction history

### Health
- `GET /health` - Health check
- `GET /metrics` - System metrics

## Testing

### Test Suites

- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Cascade Tests**: Game logic validation
- **Smoke Tests**: Basic functionality verification
- **WebSocket Tests**: Real-time communication testing

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test suite
npm run test:cascade
npm run test:smoke
```

## Database

### Migrations

Database migrations are located in `src/db/migrations/`. Run migrations with:

```bash
npm run migrate
```

### Models

Data models use native PostgreSQL with connection pooling. Models are defined in `src/models/`.

### Seeding

Seed the database with test data:

```bash
npm run seed
```

## Security

### Authentication
- JWT tokens with 30-minute expiry
- Session management with Redis
- Password hashing with bcrypt (12 rounds)

### Rate Limiting
- API endpoints: 100 requests/minute
- Spin endpoint: 2 requests/second
- Redis-backed for distributed rate limiting

### Input Validation
- Express-validator for all inputs
- Joi schemas for complex validation
- SQL injection prevention
- XSS protection with helmet

## Game Logic

### Server-Side RNG
- Cryptographically secure random number generation
- Deterministic replay capability
- Audit trail for all random events

### Game Engine
- Complete cascade logic
- Win calculation
- Free spins management
- Multiplier handling
- Anti-cheat validation

### State Management
- Persistent game state
- Recovery from disconnections
- Transaction atomicity
- Complete audit logging

## Monitoring

### Logging
- Winston logger with multiple transports
- Structured logging with JSON format
- Separate error and access logs
- Log rotation and archival

### Health Checks
- Database connectivity
- Redis connectivity
- Memory usage monitoring
- Response time tracking

### Metrics
- Active session count
- Spins per minute
- RTP monitoring
- System performance metrics

## Deployment

### Production Checklist

1. ✅ Environment variables configured
2. ✅ Database migrations applied
3. ✅ SSL certificates installed
4. ✅ Security headers configured
5. ✅ Rate limiting enabled
6. ✅ Monitoring configured
7. ✅ Backup procedures tested
8. ✅ Log rotation configured

### Docker Production

```bash
# Build production image
docker build -t infinity-storm-server .

# Run with production config
docker run -d --env-file .env.production infinity-storm-server
```

## Contributing

### Code Style
- ESLint configuration with recommended rules
- Prettier formatting (single quotes, no trailing commas)
- 100-character line limit
- Comprehensive JSDoc comments

### Git Workflow
- Feature branches for all changes
- Comprehensive commit messages
- Pull request reviews required
- Automated testing on CI

## License

Licensed under the ISC License.