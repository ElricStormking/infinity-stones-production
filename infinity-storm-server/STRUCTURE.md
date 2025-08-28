# Infinity Storm Server - Project Structure

This document outlines the complete directory structure and organization of the Infinity Storm server implementation.

## Directory Structure

```
infinity-storm-server/
│
├── 📁 src/                     # Main source code
│   ├── 📁 auth/                # Authentication & JWT management
│   ├── 📁 config/              # Application configuration
│   │   ├── database.js         # PostgreSQL configuration & pool management
│   │   ├── redis.js           # Redis configuration & session store
│   │   ├── environment.js      # Environment-specific settings
│   │   └── index.js           # Configuration exports
│   ├── 📁 controllers/         # Express route controllers
│   ├── 📁 db/                  # Database utilities & migrations
│   │   ├── cli.js             # Database CLI tools
│   │   ├── migrate.js         # Migration runner
│   │   ├── pool.js            # Connection pool utilities
│   │   └── 📁 migrations/      # Database migration files
│   ├── 📁 game/                # Game engine & logic
│   ├── 📁 middleware/          # Express middleware
│   ├── 📁 models/              # Data models
│   │   ├── CascadeStep.js     # Cascade step model
│   │   ├── GameSession.js     # Game session model
│   │   └── SpinResult.js      # Spin result model
│   ├── 📁 routes/              # Express route definitions
│   ├── 📁 services/            # Business logic services
│   │   ├── CascadeSynchronizer.js # Cascade synchronization
│   │   └── CascadeValidator.js    # Cascade validation
│   ├── 📁 utils/               # Utility functions
│   │   └── logger.js          # Winston logging configuration
│   └── 📁 websocket/           # WebSocket event handlers
│       ├── CascadeSync.js     # Cascade WebSocket handlers
│       └── gameEvents.js      # Game event WebSocket handlers
│
├── 📁 game-logic/              # Core game logic (existing)
│   └── GridEngine.js          # Grid generation & cascade logic
│
├── 📁 tests/                   # Test suites
│   ├── 📁 cascade/             # Cascade-specific tests
│   ├── 📁 smoke/               # Basic functionality tests  
│   ├── 📁 websocket/           # WebSocket tests
│   └── setup.js               # Test setup configuration
│
├── 📁 scripts/                 # Utility scripts
├── 📁 logs/                    # Application logs (generated)
├── 📁 docker/                  # Docker configurations
│   ├── 📁 game-server/         # Game server Dockerfile
│   ├── 📁 nginx/               # Nginx configuration
│   ├── 📁 postgres/            # PostgreSQL initialization
│   └── 📁 web-portal/          # Web portal Dockerfile
│
├── 📁 supabase/                # Supabase configuration
│   ├── config.toml            # Supabase configuration
│   ├── seed.sql               # Database seed data
│   └── mcp-integration.md     # MCP integration documentation
│
├── 📄 server.js                # Main server entry point
├── 📄 package.json             # Dependencies & scripts
├── 📄 docker-compose.yml       # Docker orchestration
├── 📄 jest.config.js           # Jest test configuration
├── 📄 eslint.config.js         # ESLint configuration
├── 📄 nodemon.json             # Nodemon development configuration
├── 📄 .prettierrc              # Prettier formatting rules
├── 📄 .prettierignore          # Prettier ignore patterns
├── 📄 .env.example             # Environment variables template
├── 📄 .gitignore               # Git ignore patterns
├── 📄 README.md                # Project documentation
└── 📄 STRUCTURE.md             # This file
```

## Key Components

### 🔧 Configuration Management
- **Environment**: Centralized environment-specific configuration
- **Database**: PostgreSQL connection pooling and management
- **Redis**: Session storage and caching configuration
- **Logging**: Winston-based structured logging

### 🎮 Game Logic
- **Core Engine**: Server-side game logic implementation
- **RNG**: Cryptographically secure random number generation
- **Validation**: Anti-cheat and game state validation
- **Synchronization**: Client-server cascade synchronization

### 🔐 Security
- **Authentication**: JWT-based authentication system
- **Rate Limiting**: Request rate limiting and abuse prevention
- **Input Validation**: Comprehensive input validation
- **Session Management**: Redis-backed session storage

### 📡 Communication
- **HTTP API**: RESTful API endpoints
- **WebSocket**: Real-time bi-directional communication
- **Middleware**: Request processing and error handling

### 🗄️ Data Management
- **Models**: Data structure definitions
- **Migrations**: Database schema versioning
- **Transactions**: Atomic database operations
- **Audit Trail**: Complete action logging

### 🧪 Testing
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Load and stress testing
- **Smoke Tests**: Basic functionality verification

## Development Workflow

### Setup
1. Install dependencies: `npm install`
2. Configure environment: Copy `.env.example` to `.env`
3. Start services: `npm run dev:db`
4. Run migrations: `npm run migrate`
5. Start development: `npm run dev`

### Testing
- Run all tests: `npm test`
- Run specific tests: `npm run test:cascade`
- Watch mode: `npm run test:watch`
- Coverage report: `npm run test:coverage`

### Code Quality
- Lint code: `npm run lint`
- Fix lint issues: `npm run lint:fix`
- Format code: `npm run format`
- Check formatting: `npm run format:check`

### Database Operations
- Run migrations: `npm run migrate`
- Seed database: `npm run seed`
- Reset database: `npm run db:reset`
- Database CLI: `npm run db:tables`

### Supabase Operations
- Start Supabase: `npm run sb:start`
- Stop Supabase: `npm run sb:stop`
- Check status: `npm run sb:status`
- Reset database: `npm run sb:reset`
- Verify connection: `npm run sb:verify`

## Architecture Principles

### 🏗️ Modular Design
- Clear separation of concerns
- Reusable components
- Testable modules
- Configuration-driven

### 🔒 Security First
- Server-side validation
- Encrypted communications
- Audit logging
- Rate limiting

### ⚡ Performance Optimized
- Connection pooling
- Efficient caching
- Optimized queries
- Load balancing ready

### 🧪 Test-Driven
- Comprehensive test coverage
- Automated testing
- Performance benchmarking
- Quality gates

### 🐳 Container Ready
- Docker configuration
- Environment isolation
- Scalable deployment
- Service orchestration

## Configuration Overview

### Environment Variables
- **Database**: Connection settings and pool configuration
- **Redis**: Cache and session store configuration
- **Security**: JWT secrets and encryption settings
- **Game**: Bet limits and game-specific settings
- **Logging**: Log levels and file destinations

### Feature Flags
- **Admin Panel**: Enable/disable admin functionality
- **Debug Endpoints**: Development-only endpoints
- **Detailed Logging**: Verbose logging for debugging
- **Health Checks**: System monitoring endpoints

## Next Steps

This project structure provides a solid foundation for:

1. **Phase 2**: Database schema implementation
2. **Phase 3**: Core game engine development
3. **Phase 4**: Client-server integration
4. **Phase 5**: Testing and optimization
5. **Phase 6**: Production deployment

The modular architecture ensures maintainability and scalability as the project grows.

---

*Structure completed as part of Task 1.3: Project structure setup*