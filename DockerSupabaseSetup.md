### Docker + Supabase Setup Guide (Windows-first)

This document explains how to run Infinity Storm locally using Supabase and Docker, and how to deploy it online.

#### Architecture

```mermaid
flowchart LR
  Browser[Player Browser\nGame Client (Phaser)] -->|HTTP :3000| Server[Infinity Storm Server\nNode/Express]
  Server -->|JWT + Sessions| Browser
  Server -->|TCP :6379| Redis[(Redis)]
  Server -->|Postgres (SSL)| Supabase[(Supabase Postgres)]
  Studio[Supabase Studio\n:54323] -->|API :54321| Kong[Kong API Gateway]
  Kong -->|DB :54322| Supabase
```

This guide is Windows-first (PowerShell commands, no `&&`). It includes local setup and production deployment steps.

---

## 1) Prerequisites

- Docker Desktop (latest)
- Node.js 18 (for local client builds)
- Git
- Supabase CLI v2.5x+ (newer preferred)
- PowerShell terminal

Verify tools:

```powershell
docker version
supabase --version
```

---

## 2) Ports used (free them first)

- 3000: Game server
- 54321: Supabase API (Kong)
- 54322: Supabase Postgres
- 54323: Supabase Studio UI
- 6379: Redis

If something is already on a port, stop it before continuing.

---

## 3) Environment (.env)

Create `.env` with these keys (dev-friendly defaults shown). For production, use strong secrets and locked-down values.

```dotenv
# Server
NODE_ENV=production
PORT=3000
FORCE_HTTPS=false

# JWT
JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_REFRESH_SECRET=replace-with-strong-secret
JWT_ACCESS_EXPIRY=12h
JWT_REFRESH_EXPIRY=7d

# Redis
SKIP_REDIS=false
REDIS_URL=redis://redis:6379
REDIS_HOST=host.docker.internal
REDIS_PORT=6379

# Supabase (local CLI stack)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Postgres connection (to local Supabase DB)
DB_HOST=127.0.0.1
DB_PORT=54322
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
PGSSLMODE=disable
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable
```

Notes:
- Inside Docker on Windows, `host.docker.internal` usually resolves to your host. If not, use your LAN IP (e.g., `192.168.x.x`).
- In production, set `PGSSLMODE=require` and use Supabase Cloud credentials.

---

## 4) Build the client bundle to `/dist`

You can rely on the Docker multi-stage build, or build locally for quick iteration:

```powershell
cd D:\infinity-gauntlet
npm ci
npm run build
```

Confirm `dist/` exists at repo root.

---

## 5) Start Supabase locally

From `infinity-storm-server/` (where `supabase/config.toml` resides):

```powershell
cd D:\infinity-gauntlet\infinity-storm-server
supabase start
supabase status
```

Open Studio: `http://127.0.0.1:54323`

If Studio is not exposed on 54323, you can publish it explicitly (one-time helper):

```powershell
# Find Supabase network name
docker inspect supabase_kong_infinity-storm-server --format "{{json .NetworkSettings.Networks}}"
$net = "supabase_network_infinity-storm-server" # replace if different

# Run a Studio container bound to host 54323
docker pull public.ecr.aws/supabase/studio:2025.08.04-sha-6e99ca6
docker run -d --name supabase_studio_public_exposed `
  --restart unless-stopped `
  -p 54323:3000 `
  --network $net `
  -e STUDIO_PG_META_URL=http://supabase_pg_meta_infinity-storm-server:8080 `
  -e POSTGRES_PASSWORD=postgres `
  -e SUPABASE_URL=http://supabase_kong_infinity-storm-server:8000 `
  -e SUPABASE_PUBLIC_URL=http://127.0.0.1:54321 `
  -e AUTH_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long `
  -e SUPABASE_ANON_KEY=$env:SUPABASE_ANON_KEY `
  -e SUPABASE_SERVICE_KEY=$env:SUPABASE_SERVICE_ROLE_KEY `
  public.ecr.aws/supabase/studio:2025.08.04-sha-6e99ca6
```

### Apply schema SQL

Run these via Studio SQL editor or psql:

- `infinity-storm-server/src/db/migrations/002_complete_casino_schema.sql`
- `infinity-storm-server/src/db/migrations/005_disable_recursive_session_cleanup.sql`

Via psql on Windows:

```powershell
psql "host=127.0.0.1 port=54322 user=postgres password=postgres dbname=postgres" `
  -f D:\infinity-gauntlet\infinity-storm-server\src\db\migrations\002_complete_casino_schema.sql

psql "host=127.0.0.1 port=54322 user=postgres password=postgres dbname=postgres" `
  -f D:\infinity-gauntlet\infinity-storm-server\src\db\migrations\005_disable_recursive_session_cleanup.sql
```

---

## 6) Configure Docker Compose

Edit `infinity-storm-server/docker-compose.production.yml` for local dev:

- `ports: - "${PORT:-3000}:3000"`
- `SKIP_REDIS=false`
- `REDIS_URL=redis://redis:6379`
- `DB_HOST=127.0.0.1` (or `host.docker.internal` / LAN IP)
- `DB_PORT=54322`
- `PGSSLMODE=disable`
- Provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 7) Build and run the server

```powershell
cd D:\infinity-gauntlet\infinity-storm-server
docker compose -f docker-compose.production.yml build infinity-storm
docker compose -f docker-compose.production.yml up -d infinity-storm
docker logs -f infinity-storm-server
```

If client assets seem stale:

```powershell
docker compose -f docker-compose.production.yml build --no-cache infinity-storm
```

---

## 8) Verify locally

- Health: `http://127.0.0.1:3000/health`
- Login page: `http://127.0.0.1:3000/test-player-login.html`
- Game: `http://127.0.0.1:3000/`
- Admin: `http://127.0.0.1:3000/admin/test-dashboard`

If you drop to demo mode, check DevTools for 401 and confirm `/api/auth/validate` succeeds.

---

## 9) Troubleshooting quick refs

- Port 3000 taken: stop the conflicting process and rerun compose
- HTTPS redirects locally: clear browser HSTS; ensure `FORCE_HTTPS=false`
- Prefer `127.0.0.1` over `localhost` to avoid cached HSTS
- 429 on spins: loopback is exempted locally; hard reload to ensure updated JS
- 401 after login: clear localStorage, ensure token persisted; verify `/api/auth/validate`
- DB SSL error: for local set `PGSSLMODE=disable`, for Supabase Cloud `require`
- Redis errors: ensure `redis` service running; `docker ps` and `docker logs`
- Missing `/dist`: run `npm run build` or rebuild image `--no-cache`
- Browser caching old JS: Ctrl+F5 (server sends no-cache in dev)

---

## 10) Online deployment (production)

Recommended: Supabase Cloud + VM with Docker Compose behind Nginx and TLS.

### Production environment

- `FORCE_HTTPS=true`
- `PGSSLMODE=require`
- Use Supabase Cloud project values for `SUPABASE_URL`, `SUPABASE_*_KEY`
- Strong `JWT_*_SECRET`, shorter `JWT_ACCESS_EXPIRY` (15–30m)
- `DISABLE_STATE_VALIDATION=false`
- Review `production_Ready_Skipped.md`

### Nginx snippet (TLS + proxy)

```nginx
server {
  listen 80;
  server_name game.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name game.example.com;

  ssl_certificate /etc/letsencrypt/live/game.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Issue a certificate (Ubuntu example):

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d game.example.com --email you@example.com --agree-tos --redirect
```

Deploy with compose on the VM:

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

---

## 11) Production checklist (tighten everything)

See `production_Ready_Skipped.md` and ensure:

- Restrict CORS to production domains
- Restore strict rate limits (no loopback bypass)
- Enable full state validation
- Enable financial logging
- Do not expose Supabase Studio publicly

---

## 12) Appendix

### Handy PowerShell

```powershell
# Rebuild without cache
cd D:\infinity-gauntlet\infinity-storm-server
docker compose -f docker-compose.production.yml build --no-cache infinity-storm

# Restart server container
docker compose -f docker-compose.production.yml restart infinity-storm

# Tail logs
docker logs infinity-storm-server --tail=200 -f
```

### Useful local URLs

- Game: `http://127.0.0.1:3000/`
- Health: `http://127.0.0.1:3000/health`
- Login: `http://127.0.0.1:3000/test-player-login.html`
- Admin: `http://127.0.0.1:3000/admin/test-dashboard`
- Supabase Studio: `http://127.0.0.1:54323`

Source: `https://github.com/ElricStormking/infinity-stones-production`

