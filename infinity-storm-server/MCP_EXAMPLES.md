# MCP Database Command Examples
Generated on: 2025-08-25T18:20:02.171Z

## Database Queries

### Get player statistics
**MCP Command**: "Query the users table to get player statistics"
```sql
SELECT username, balance, created_at FROM users WHERE active = true ORDER BY balance DESC LIMIT 10
```

### Analyze recent spins
**MCP Command**: "Show me the last 20 spins with their win amounts and player info"
```sql
SELECT s.spin_id, s.player_id, s.bet_amount, s.total_win, s.created_at FROM spins s ORDER BY s.created_at DESC LIMIT 20
```

### Calculate RTP (Return to Player)
**MCP Command**: "Calculate the overall RTP by summing total bets vs total wins"
```sql
SELECT (SUM(total_win) / NULLIF(SUM(bet_amount), 0) * 100) as rtp_percentage FROM spins
```


## Data Operations

### Create test player
**MCP Command**: "Create a new test user with username 'test_player' and initial balance 1000"
```sql
INSERT INTO users (username, email, balance) VALUES ('test_player', 'test@example.com', 1000.00)
```

### Update player balance
**MCP Command**: "Add 500 to the balance of player with username 'demo_player'"
```sql
UPDATE users SET balance = balance + 500 WHERE username = 'demo_player'
```

### Record spin result
**MCP Command**: "Insert a new spin record for player 'demo_player' with bet 10 and win 25"
```sql
INSERT INTO spins (spin_id, player_id, bet_amount, total_win, initial_grid, cascades) VALUES (...)
```


## Analytics

### Daily revenue report
**MCP Command**: "Show daily revenue for the last 7 days"
```sql
SELECT DATE(created_at) as day, SUM(bet_amount) as total_bets, SUM(total_win) as total_wins FROM spins WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY DATE(created_at)
```

### Top winning spins
**MCP Command**: "Find the top 10 highest winning spins"
```sql
SELECT spin_id, player_id, bet_amount, total_win, (total_win/bet_amount) as multiplier FROM spins ORDER BY total_win DESC LIMIT 10
```


## Usage Notes
- Use natural language with Claude AI to describe what you want to do
- Claude can translate your requests into appropriate SQL queries
- Always verify results before making critical changes
- Use transactions for complex operations that need to be atomic
