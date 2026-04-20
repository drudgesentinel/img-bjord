# Updating

Use this runbook when deploying new commits to an already-running server.

## 1) Pull latest code

```bash
cd /opt/img-bjord
git fetch --all --prune
git pull --ff-only
```

## 2) Apply the right update path

### Frontend-only changes (Svelte/UI/routes)

```bash
cd /opt/img-bjord/frontend
npm install
npm run build
sudo systemctl restart bjord-frontend.service
```

### Backend-only changes (Express/API)

```bash
cd /opt/img-bjord
npm install
sudo systemctl restart bjord-api.service
```

### Database/schema changes (`db/schema.sql`)

```bash
cd /opt/img-bjord
set -a
source /etc/bjord/bjord.env
set +a
./bjprod migrate
sudo systemctl restart bjord-api.service
sudo systemctl restart bjord-frontend.service
```

## 3) Verify services and logs

```bash
sudo systemctl status bjord-api.service bjord-frontend.service
journalctl -u bjord-api.service -u bjord-frontend.service -n 100 --no-pager
```

If both frontend and backend changed in the same release, run both build/install paths and restart both services.
