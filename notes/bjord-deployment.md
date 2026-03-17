My deploy steps on Debian 13 (4GB Racknerd VM)
```
apt update -y && apt upgrade -y
# rakudo isn't strictly necessary if you plan on doing DB modification directly with psql
# use docker instead if you want. That'll break all the rakudo scripts and maybe other stuff too
# firewalld is optional. 
apt install -y git podman rakudo firewalld nginx certbot python3-certbot-nginx postgresql

# allow only ports 80/443/22. Make sure you're actually bound to an interface.
# this can be done via `firewall-cmd --zone=public --list-all`
firewall-cmd --permanent --zone=public \
  --add-service=ssh \
  --add-service=http \
  --add-service=https

firewall-cmd --reload

#add non root user for img-bjord

useradd krepost
su krepost


# install nvm for node version management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

source ~/.bashrc
nvm install --lts && nvm use --lts

```

# bjord deployment checklist (VPS)

Use this in order. Do not cut over DNS until the verification section passes.

## 1) VPS + OS baseline

- Create non-root deploy user.
- Enable firewall (`22`, `80`, `443` only).
- Install runtime deps:
  - Node.js LTS
  - PostgreSQL client tools
  - reverse proxy (nginx or caddy)
  - git
- Configure system clock/timezone + automatic security updates.

## 2) Clone + app user permissions

- Clone repo as deploy user.
- Ensure writable directories for runtime data:
  - uploads directory (if local storage)
  - logs directory (if file logs are used)
- Confirm app process is **not** run as root.

## 3) Environment variables (required)

Create production env file and set at least:

- `DATABASE_URL` (strong DB user/pass, not dev defaults)
- Session/auth secret envs used by backend (strong random values)
- `NODE_ENV=production`

Media/session related (recommended explicit values):

- `MEDIA_STORAGE_DRIVER=local`
- `UPLOAD_DIR=data/uploads`
- `UPLOAD_PUBLIC_PREFIX=/api/uploads`
- `MAX_IMAGE_UPLOAD_BYTES=104857600` (or your chosen limit)
- `SESSION_TABLE_NAME=user_sessions`
- `SESSION_PRUNE_INTERVAL_SECONDS=86400`

If using S3 later, set the S3 vars instead of local upload pathing.

## 4) Database prep

- Provision Postgres DB/user with least privileges needed.
- Apply schema from `db/schema.sql`.
- Verify tables/indexes are present.
- Verify seed board exists (now `/general/`).

## 5) Build + run process

- Install dependencies with clean install.
- Build frontend for production.
- Start API/frontend in production mode.
- Run with process supervisor (`systemd`, `pm2`, etc.) and auto-restart.

Minimum process-manager requirements:

- restart on failure
- startup on boot
- centralized logs
- environment file loading

## 6) Reverse proxy + TLS

- Proxy public traffic to app port.
- Enable HTTPS (Let’s Encrypt).
- Redirect HTTP -> HTTPS.
- Set upload/body limits to match app media limit.
- Set sane proxy/read/send timeouts for video uploads.
- Pass real client IP headers.

## 7) App health + monitoring

- Verify health endpoints behind proxy:
  - `/healthz`
  - `/readyz`
- Add basic uptime checks.
- Set log rotation.
- Set disk space alerts (DB volume + uploads volume).

## 8) Pre-cutover functional smoke test

Test from browser before DNS switch:

- Home + board list loads.
- Create account and login works.
- Admin access works (promote/check admin path).
- Create thread (subject/body form aligned and submits).
- Reply to thread.
- Upload image + upload video.
- External link embeds render (YouTube/Reddit/etc where supported).
- Logout/login cycle works.

## 9) Backup/restore readiness (vital)

Before going public:

- Nightly Postgres backup configured.
- Upload directory backup configured.
- Run one manual restore test to a temp DB/path.

If restore test fails, do not launch.

## 10) Go-live and immediate post-launch checks

- Point DNS to VPS.
- Re-run smoke test over public domain.
- Watch logs for 15-30 minutes for:
  - CSRF/auth errors
  - 413 upload errors (proxy body size)
  - DB connection/session errors
  - file permission issues on uploads

## 11) Rollback plan (prepare in advance)

- Keep previous deploy artifact/commit available.
- Keep previous env/proxy config backup.
- Document exact rollback steps:
  1. stop current service
  2. checkout previous commit
  3. restart services
  4. verify health endpoints

---

## Quick preflight (copy before deploy)

- [ ] Secrets set (no defaults)
- [ ] DB schema applied
- [ ] Upload path writable + persistent
- [ ] TLS active
- [ ] Proxy upload limits configured
- [ ] Health endpoints green
- [ ] Backup + restore test passed
- [ ] Admin account confirmed
- [ ] Full smoke test passed
