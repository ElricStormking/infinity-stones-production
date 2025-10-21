# Mock Portal Validation Checklist

Use this checklist when verifying Supabase transaction logging through the mock portal.

1. Ensure Supabase local stack is running (`supabase start`) and environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in `.env`.
2. Start the Infinity Storm server (`npm run dev`) so the Express app serves `/debug/portal` and the `/portal/mock/credit` endpoint.
3. Open `http://localhost:3000/debug/portal` in a browser. Keep the default portal secret (`portal-dev-secret`) unless overridden via `PORTAL_MOCK_SECRET`.
4. Enter a `playerId` (e.g., `qa_player_01`) and submit the form. The portal auto-creates the account (real player, `is_demo=false`) if it does not exist, returning the UUID (and default password only on first creation).
5. In Supabase Studio (or via SQL), query the `players` and `transactions` tables to verify the player exists, credits match, and a `deposit` row was recorded with the same `player_id`.
6. Launch additional credits or spins using the same `playerId` to confirm balances accumulate and `spin_results` rows reuse the same UUID.
7. Attempt a request with an incorrect portal secret and verify the API returns HTTP 401 without mutating balances (check server logs and Supabase table).
