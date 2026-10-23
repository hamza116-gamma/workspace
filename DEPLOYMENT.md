# Deployment

How to run this app in production. Written 2026-10-10 (step 7).

## Shape of the deployment

```
browser ──HTTPS──> reverse proxy (Caddy, one domain, auto HTTPS)
                     ├─ /api/*, /socket.io/*  ─> backend  (Node, port 5000)
                     └─ everything else       ─> frontend (Next.js, port 3000)
backend ──> MongoDB Atlas, Cloudinary, SMTP
```

**Use one domain for both** (e.g. `https://chat.example.com` and
`https://chat.example.com/api`). The session cookie is `SameSite=Lax` and
private files are served `Cross-Origin-Resource-Policy: same-site`, so the
frontend and API must be on the same site. One domain behind a proxy is the
simplest way to get that. Subdomains of one domain (`app.` + `api.`) also
work. Two unrelated domains (e.g. `*.vercel.app` + `*.onrender.com`) do NOT.

**Run exactly one backend process.** Three things live in that process's
memory:
- the scheduled-message sender (`services/scheduler.js`)
- the rate limits
- the Socket.IO rooms

Two backend instances would send scheduled messages twice and split live
updates. Scaling out later needs a shared store (Redis adapter + Redis rate
limits + a single scheduler). For now: one machine, one backend process.

## Production settings

### Backend `backend/.env`

| Setting | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `CLIENT_URL` | `https://chat.example.com` (https only; comma-separate several) |
| `TRUST_PROXY` | `1` (behind Caddy, so rate limits see real client IPs) |
| `MONGO_URI` | the production Atlas connection string (a separate database from development) |
| `SESSION_SECRET` | `openssl rand -hex 32`. Never reuse the development one |
| `SESSION_TTL_DAYS` / `COOKIE_NAME` | `7` / `sid` (defaults) |
| `EMAIL_*` | real SMTP account (invites, password resets) |
| `CLOUDINARY_*` | production Cloudinary account (or a separate folder/account from dev) |
| `MAX_UPLOAD_BYTES` | `26214400` (25 MB) unless you want another limit |
| `LOG_LEVEL` | `info` |

In production the backend **refuses to start** if `SESSION_SECRET` is short or
a placeholder, if `CLIENT_URL` isn't https, or if `MONGO_URI` points at
localhost (`config/env.js`). With `NODE_ENV=production`, cookies are `Secure`
(HTTPS only) and 500 errors don't leak details.

### Frontend `frontend/.env.production`

The frontend reads these at build time, so rebuild after changing them:

```
NEXT_PUBLIC_API_URL=https://chat.example.com/api
NEXT_PUBLIC_SOCKET_URL=https://chat.example.com
```

## First deploy on a Linux server (VPS)

Any small VPS works for a team of this size: 1-2 vCPU, 2 GB RAM, Ubuntu 24.04.

1. **DNS:** an `A` record `chat.example.com` → the server's IP.
2. **Software:** Node.js 22 LTS (or 24), Caddy, git. Firewall: allow 22, 80, 443 only.
3. **Code:** copy the project to `/srv/chat`, then:
   ```bash
   cd /srv/chat/backend && npm ci --omit=dev
   cd /srv/chat/frontend && npm ci && npm run build
   ```
4. **Settings:** create `backend/.env` and `frontend/.env.production` as above.
   Build the frontend after creating its env file.
5. **Keep both running** with systemd (or pm2): one unit for
   `node src/server.js` in `backend/`, one for `npx next start -p 3000` in
   `frontend/`, both `Restart=always`.
6. **HTTPS:** put `deploy/Caddyfile` (with your domain) at `/etc/caddy/Caddyfile`
   and run `systemctl reload caddy`. Caddy gets and renews the certificate.
7. **Check:** `https://chat.example.com/api/health` should show
   `"database":"up"`. Then sign up, create a workspace, send a message, upload
   a file, and start a huddle from two devices. Huddles need HTTPS, so test
   them on the real domain.

## Before going live

- [ ] Production MongoDB is separate from development, with its own user and
      password, and network access limited to the server's IP.
- [ ] Delete the QA test accounts and test workspaces from production data,
      if you copied the development database (see
      `scripts/qa-test-accounts.local.md`).
- [ ] New `SESSION_SECRET`. Rotate any key that was ever shared or committed
      (Cloudinary, SMTP, Mongo).
- [ ] `npm test` passes in `backend/`. Run `npm run test:security` against the
      server once with test accounts, then remove those accounts.
- [ ] Old public attachments made private:
      `npm run migrate:private-files -- --apply` (safe to re-run).
- [ ] Email works (send an invite to yourself).

## Backups

- **Atlas:** paid clusters (M10+) have continuous backups with point-in-time
  restore. Turn them on and test a restore once. The free M0 tier has no
  backups, so on M0 run a nightly `mongodump --uri "$MONGO_URI" --gzip
  --archive=/backups/chat-$(date +%F).gz` from cron, keep 14 days, and copy
  them off the server.
- **Files:** Cloudinary keeps the files. Turn on Cloudinary "backup" in its
  settings if your plan includes it.
- **Settings:** keep a copy of both env files in a password manager, not in git.

## Monitoring

- **Uptime:** point an uptime checker (UptimeRobot, Better Stack, etc.) at
  `https://chat.example.com/api/health`. It returns `"database":"down"` when
  MongoDB is unreachable.
- **Logs:** `journalctl -u <backend-unit> -f`. Errors are logged at `ERROR`
  level. `LOG_LEVEL=info` hides per-socket debug lines.
- **Cloudinary Admin API budget:** every attached file costs one Admin API call
  (upload verification). The free plan allows 500 per hour. Watch the usage
  page if the team shares a lot of files.

## Updating

```bash
cd /srv/chat && <pull or copy the new code>
cd backend && npm ci --omit=dev && npm test
cd ../frontend && npm ci && npm run build
sudo systemctl restart chat-backend chat-frontend
```

Restarting the backend drops live connections for a few seconds. Clients
reconnect and catch up on their own.
