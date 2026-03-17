This is an image board written in Javascript.

The goal is to make it easy to host, and easy to use.

.env should contain your DB URL, something like:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard

For tests, use a separate database:
DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:5432/imageboard_test

Image/media envs:
- MEDIA_STORAGE_DRIVER=local (default) or s3 (scaffold)
- MAX_IMAGE_UPLOAD_BYTES=104857600
- AVIF_QUALITY=50
- AVIF_EFFORT=4
- UPLOAD_DIR=data/uploads (local)
- UPLOAD_PUBLIC_PREFIX=/api/uploads (local)

Supported uploads: images (converted to AVIF), `video/mp4`, and `video/webm`.

S3 scaffold envs (for future wiring):
- S3_ENDPOINT
- S3_BUCKET
- S3_REGION
- S3_KEY_PREFIX=posts
- S3_PUBLIC_BASE_URL

You need podman installed for things to work out of the box

`./bjdev db up` now initializes both `imageboard` and `imageboard_test` databases and applies `db/schema.sql` to each.

## Reverse proxy (nginx) PoC deployment

This project can run behind nginx with Let's Encrypt.

- API server (Express): run on localhost, e.g. `127.0.0.1:3000`
- Frontend server (SvelteKit adapter-node): build and run on localhost, e.g. `127.0.0.1:4173`
- nginx terminates TLS and forwards:
  - `/api/*` -> `http://127.0.0.1:3000`
  - all other paths -> `http://127.0.0.1:4173`

Required envs for production:

- `NODE_ENV=production`
- `SESSION_SECRET=<long-random-secret>`
- `DATABASE_URL=...`

Optional auth debugging (useful when tracking down intermittent `401 unauthorized`):

- `AUTH_DEBUG=true`
- When enabled, auth/admin failures include response header `x-bjord-auth-debug`
	(visible in browser Network tab response headers), and a structured warning log line.

Session/cookie note:

- Session cookies are `secure: auto` in production. Over HTTPS (recommended), cookies are secure.
- If you are testing PoC over plain HTTP before TLS is in place, sessions still work.

Minimal nginx site example:

```nginx
server {
	listen 80;
	server_name example.com;
	return 301 https://$host$request_uri;
}

server {
	listen 443 ssl http2;
	server_name example.com;
	client_max_body_size 12m;

	ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

	location /api/ {
		proxy_pass http://127.0.0.1:3000;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

	location / {
		proxy_pass http://127.0.0.1:4173;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

Upload note:

- If image/video posting fails with a browser `NetworkError`, nginx may be rejecting request size before it reaches the app.
- Set `client_max_body_size` to at least your app limit.
- App-side upload limit is controlled by `MAX_IMAGE_UPLOAD_BYTES` (default 100MB).
