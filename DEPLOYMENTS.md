# Deployments

This document consolidates deployment guidance from:

- `notes/bjord-deployment.md`
- `notes/nginx-considerations.md`
- `notes/systemd/bjord-api.service`
- `notes/systemd/bjord-frontend.service`
- `notes/systemd/bjord.env.example`
- `notes/deployment-scripts/bootstrap-postgres.sh`
- `notes/deployment-scripts/print-database-url.sh`

It is written for a Debian-based VPS deployment of `img-bjord` with:

- API on `127.0.0.1:3000`
- Frontend on `127.0.0.1:3001`
- nginx as reverse proxy + TLS termination
- PostgreSQL as system of record

---

## 1. High-level architecture

- `src/` runs the Express API server.
- `frontend/` runs the SvelteKit adapter-node server.
- nginx terminates TLS and routes:
  - `/api/*` -> API (`127.0.0.1:3000`)
  - everything else -> frontend (`127.0.0.1:3001`)

---

## 2. One-time server bootstrap (Debian)

As `root`:

```bash
apt update -y && apt upgrade -y
apt install -y git podman rakudo firewalld nginx certbot python3-certbot-nginx postgresql
```

Open only SSH + HTTP + HTTPS:

```bash
firewall-cmd --permanent --zone=public \
  --add-service=ssh \
  --add-service=http \
  --add-service=https
firewall-cmd --reload
```

Create directories and deploy user:

```bash
mkdir -p /opt/img-bjord
mkdir -p /etc/bjord
useradd krepost
chown -R krepost:krepost /opt/img-bjord
```

---

## 3. Clone app + install Node dependencies

Switch to deploy user:

```bash
su krepost
```

Install `nvm` + Node LTS:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

Clone and install:

```bash
git clone ssh://git@codeberg.org/drudgesentinel/img-bjord.git /opt/img-bjord
cd /opt/img-bjord
npm install
cd frontend
npm install
npm run build
```

---

## 4. Database bootstrap + `DATABASE_URL`

From repo root (`/opt/img-bjord`), initialize Postgres role/db/schema:

```bash
sudo APP_DB_PASS='REPLACE_ME' bash notes/deployment-scripts/bootstrap-postgres.sh
```

Generate URL-encoded `DATABASE_URL` and update env file:

```bash
sudo APP_DB_PASS='REPLACE_ME' APP_ENV_FILE='/etc/bjord/bjord.env' \
  bash notes/deployment-scripts/print-database-url.sh
```

Notes:

- `bootstrap-postgres.sh` applies `db/schema.sql`.
- `print-database-url.sh` URL-encodes password and writes `DATABASE_URL=...`.
- If password has special characters, do not hand-assemble the URL.

---

## 5. Environment file

Create `/etc/bjord/bjord.env` (permissions `600`). Use `notes/systemd/bjord.env.example` as baseline.

Minimum required values:

```env
DATABASE_URL=postgres://...
SESSION_SECRET=replace_with_long_random_secret
NODE_ENV=production
```

Recommended media/session values:

```env
MEDIA_STORAGE_DRIVER=local
UPLOAD_DIR=/var/lib/bjord/uploads
TEMP_UPLOAD_DIR=/var/lib/bjord/tmp-uploads
UPLOAD_PUBLIC_PREFIX=/api/uploads
MAX_IMAGE_UPLOAD_BYTES=104857600
SESSION_TABLE_NAME=user_sessions
SESSION_PRUNE_INTERVAL_SECONDS=86400
```

Create writable runtime dirs (owned by service user):

```bash
sudo mkdir -p /var/lib/bjord/uploads /var/lib/bjord/tmp-uploads
sudo chown -R bjord:bjord /var/lib/bjord
```

If your service user is not `bjord`, update ownership and service unit files accordingly.

---

## 6. systemd services

Install service units:

- `notes/systemd/bjord-api.service` -> `/etc/systemd/system/bjord-api.service`
- `notes/systemd/bjord-frontend.service` -> `/etc/systemd/system/bjord-frontend.service`

Important:

- Update `User=` and `Group=` to your deploy user/group if needed.
- Confirm `ExecStart=` points to the correct Node binary path.
  - If using `nvm`, this is often under `~/.nvm/versions/node/<version>/bin/node`.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bjord-api.service bjord-frontend.service
sudo systemctl restart bjord-api.service bjord-frontend.service
sudo systemctl status bjord-api.service bjord-frontend.service
```

---

## 7. nginx + TLS

Apply an nginx site config based on `notes/nginx-considerations.md`.

Critical routing rules:

- Keep API `proxy_pass` as `http://127.0.0.1:3000` (no trailing slash) under `/api/`.
- Route `/` to frontend (`http://127.0.0.1:3001/`).
- Set `client_max_body_size` to at least `MAX_IMAGE_UPLOAD_BYTES` equivalent.
- Set generous upload timeouts for video uploads.

After config:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Provision TLS (certbot), then force HTTP -> HTTPS redirect.

---

## 8. Migrations during deploy

`bjprod` is production-oriented and uses `DATABASE_URL`.

If `DATABASE_URL` is defined in `/etc/bjord/bjord.env`, run migrations like:

```bash
set -a
source /etc/bjord/bjord.env
set +a
cd /opt/img-bjord
./bjprod migrate
```

`./bjprod show-url` can help confirm the currently loaded `DATABASE_URL` value source in your shell context.

---

## 8.1 Updating an existing deployment (`git pull` + restarts)

Use this flow whenever deploying new commits to an already-running server.

### 1) Pull latest code

```bash
cd /opt/img-bjord
git fetch --all --prune
git pull --ff-only
```

### 2) Apply the right update path

#### Frontend-only changes (Svelte/UI/routes)

```bash
cd /opt/img-bjord/frontend
npm install
npm run build
sudo systemctl restart bjord-frontend.service
```

#### Backend-only changes (Express/API)

```bash
cd /opt/img-bjord
npm install
sudo systemctl restart bjord-api.service
```

#### Database/schema changes (`db/schema.sql`)

```bash
cd /opt/img-bjord
set -a
source /etc/bjord/bjord.env
set +a
./bjprod migrate
sudo systemctl restart bjord-api.service
sudo systemctl restart bjord-frontend.service
```

### 3) Verify services and logs

```bash
sudo systemctl status bjord-api.service bjord-frontend.service
journalctl -u bjord-api.service -u bjord-frontend.service -n 100 --no-pager
```

If both frontend and backend changed in the same release, run both build/install paths and restart both services.

---

## 9. Functional pre-cutover smoke test

Before DNS cutover, verify:

- Home and board list loads.
- Account creation + login/logout flow.
- Admin flow works.
- Create thread + reply works.
- Image/video upload works.
- Supported link embeds render.
- Health endpoints are green through proxy:
  - `/healthz`
  - `/readyz`

---

## 10. Go-live checks

After DNS switch:

- Re-run smoke tests on public domain.
- Watch logs for 15-30 minutes for:
  - auth/session/CSRF errors
  - `413` upload errors
  - DB connection/session issues
  - upload directory permission errors

---

## 11. Backup and rollback

Before launch:

- Configure nightly Postgres backups.
- Backup uploads path (`/var/lib/bjord/uploads`).
- Perform at least one restore test.

Rollback prep:

1. Keep previous known-good commit/deploy artifact.
2. Keep previous env/proxy config backups.
3. Document exact rollback command sequence.

---

## 12. Quick preflight checklist

- [ ] Secrets set (no defaults)
- [ ] `DATABASE_URL` configured correctly
- [ ] DB schema applied
- [ ] Upload paths writable + persistent
- [ ] systemd units enabled and healthy
- [ ] TLS active and HTTP redirects to HTTPS
- [ ] Proxy upload limits/timeouts aligned with app limits
- [ ] Health endpoints green
- [ ] Backup and restore test passed
- [ ] Admin account verified
- [ ] Full smoke test passed
