# Supabase MCP Integration Setup

This document outlines the integration between Supabase and MCP (Model Context Protocol) for the Infinity Storm Casino Game.

## Overview

The Supabase local instance is configured to work seamlessly with MCP tools for database operations, authentication, and real-time features.

## Configuration

### Local Development Setup

1. **Supabase Local Instance**
   - Database: PostgreSQL 15 on port 54321
   - API: REST API on port 54321
   - Studio: Web interface on port 54323
   - Auth: JWT-based authentication enabled

2. **Database Schema**
   - `users`: Player accounts and balances
   - `spins`: Game spin records and results
   - `game_sessions`: Active game sessions
   - `cascade_steps`: Detailed cascade step tracking
   - `transaction_logs`: Financial transaction audit trail

### MCP Integration Points

1. **Database Operations**
   - Real-time database queries through MCP tools
   - CRUD operations on game data
   - Transaction management and rollbacks
   - Performance monitoring and analytics

2. **Authentication Integration**
   - JWT token validation through Supabase Auth
   - User session management
   - Role-based access control
   - Secure API endpoint access

3. **Real-time Features**
   - WebSocket connections for live game events
   - Real-time cascade synchronization
   - Player session monitoring
   - Live balance updates

## Environment Variables

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54321/postgres
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=54321

# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoQ2C8iSy2zbhzM-PQp2Jg2MhI6HJEtY8E
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qOLsz4xe7RIGMmjpbr9Jp0
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

## Usage Instructions

### Starting the Local Instance

```bash
# Navigate to project directory
cd infinity-storm-server

# Start Supabase local development stack
supabase start

# Reset database with migrations and seed data
supabase db reset

# Access Supabase Studio (web interface)
# Open: http://127.0.0.1:54323
```

### Testing the Connection

```bash
# Run connection test
node test-supabase-connection.js

# Test game server integration
npm test

# Run smoke tests
npm run test:smoke
```

### MCP Tool Integration

1. **Database Queries**
   ```javascript
   // Example MCP database query
   const { data, error } = await supabase
     .from('spins')
     .select('*')
     .eq('player_id', 'demo_player')
     .order('created_at', { ascending: false })
     .limit(10);
   ```

2. **Real-time Subscriptions**
   ```javascript
   // Example real-time cascade tracking
   const subscription = supabase
     .channel('cascade_updates')
     .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'cascade_steps'
     }, handleCascadeUpdate)
     .subscribe();
   ```

3. **Authentication**
   ```javascript
   // Example user authentication
   const { data, error } = await supabase.auth.signInWithPassword({
     email: 'demo@infinitystorm.dev',
     password: 'demo123'
   });
   ```

## Security Considerations

1. **Development Keys**: The provided JWT keys are for local development only
2. **Production Setup**: Use environment-specific keys in production
3. **Database Access**: Service role key allows full database access
4. **API Security**: Implement proper row-level security (RLS) policies

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure Docker is running
   - Check if PostgreSQL container is healthy
   - Verify port 54321 is available

2. **Database Not Found**
   - Run `supabase db reset` to recreate database
   - Check seed.sql for any syntax errors
   - Verify migrations are applied correctly

3. **Authentication Errors**
   - Verify JWT secret configuration
   - Check user table has demo user
   - Ensure auth is enabled in config.toml

### Useful Commands

```bash
# Check Supabase status
supabase status

# View logs
supabase logs

# Stop all services
supabase stop

# Generate TypeScript types
supabase gen types typescript --local > types/supabase.ts
```

## Integration with Game Server

The game server (`server.js`) integrates with Supabase through:

1. **Database Pool**: Direct PostgreSQL connections for high-performance operations
2. **Supabase Client**: REST API for standard CRUD operations
3. **Real-time**: WebSocket subscriptions for live game events
4. **Authentication**: JWT validation for secure API access

## Next Steps

1. **Implement Row-Level Security (RLS)**: Add proper security policies
2. **Add Migrations**: Create structured database migrations
3. **Real-time Gaming**: Implement live multiplayer features
4. **Analytics**: Add game analytics and reporting
5. **Backup & Recovery**: Implement backup strategies