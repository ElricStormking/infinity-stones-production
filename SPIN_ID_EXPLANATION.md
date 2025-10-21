# Spin ID Explanation

## Two Types of "Spin ID" in the System

### 1. **Runtime Spin ID** (Temporary, Not Stored)
- **Format**: `spin_1729512345678` (timestamp-based)
- **Generated**: During spin processing on the server
- **Lifespan**: Only exists during that specific spin request
- **Purpose**:
  - Debug logging during spin processing
  - Console output tracking
  - Cascade synchronization tracking (real-time)
  - Client-side in-flight spin tracking
  - **Visible in**: Debug overlay, server console logs
  
**Example**:
```javascript
// Generated in GameEngine during spin
this.spinId = `spin_${Date.now()}`;
console.log(`Processing spin ${this.spinId}...`);
```

**Not stored in database** - disposable identifier for runtime tracking only.

---

### 2. **Database Spin ID** (Permanent UUID)
- **Format**: UUID (e.g., `4e6a9d2f-1234-5678-90ab-cdef12345678`)
- **Generated**: By PostgreSQL/Supabase on insert
- **Lifespan**: Permanent (primary key)
- **Column**: `spin_results.id` (UUID PRIMARY KEY)
- **Purpose**:
  - Permanent unique identifier for each spin record
  - Foreign key references (e.g., jackpot_contributions)
  - Transaction audit trail
  - Historical data analysis
  - **Visible in**: Transaction History UI, Supabase dashboard

**Example**:
```sql
CREATE TABLE spin_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- This is the permanent "spin_id"
    player_id UUID REFERENCES players(id),
    ...
);
```

---

## Transaction History UI Fix

### Problem
The API endpoint was looking for `spin_id` field, but the database table uses `id` as the primary key. Also, `player_id` wasn't being returned.

### Solution (Commit: XXXXXX)

**API Endpoint** (`infinity-storm-server/server.js`):
```javascript
// Map to required fields
const rows = (result.rows || []).map(r => ({
  bet_time: r.created_at,
  player_id: r.player_id,                           // ✅ Now included
  spin_id: r.id || r.spin_id || r.spinId,          // ✅ Uses database UUID 'id'
  bet_amount: Number(r.bet_amount),
  total_win: Number(r.total_win),
  game_mode: r.game_mode
}));
```

**UI Display** (`src/managers/UIManager.js`):
- Adjusted column widths to better display UUIDs
- Shows truncated UUIDs: `4e6a9d2f…12345678` (first 10 + last 10 chars)
- Both Player ID and Spin ID now visible in Transaction History

---

## When to Use Each ID

| Use Case | Use Runtime ID | Use Database UUID |
|----------|---------------|-------------------|
| Debug logging during spin | ✅ | ❌ |
| Server console output | ✅ | ❌ |
| Storing in database | ❌ | ✅ |
| Transaction history UI | ❌ | ✅ |
| Audit trail | ❌ | ✅ |
| Foreign key references | ❌ | ✅ |
| Real-time cascade sync | ✅ | ❌ |
| Client debugging | ✅ | ❌ |

---

## Summary

**Runtime Spin ID**: Temporary debug identifier, visible in debug overlay and console  
**Database Spin ID**: Permanent UUID stored in `spin_results.id`, visible in Transaction History

Both serve different purposes - runtime for debugging, database for persistence and audit.

