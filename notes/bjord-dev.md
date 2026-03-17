Going to use Podman to spin up dev envs without requiring root
Create a podman image of postgres for testing:
podman run --rm -d --name imageboard-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=imageboard postgres:16

for raku scripts, i should aim to bring the system to a specific state, as opposed to
running commands and strictly handling the resulting output

Session storage:
- Sessions are stored in Postgres (table defaults to `user_sessions`).
- Logout destroys the current session immediately.
- Expired sessions are pruned every 24 hours by default.

Optional session envs:
- SESSION_TABLE_NAME=user_sessions
- SESSION_PRUNE_INTERVAL_SECONDS=86400
- SESSION_STORE=memory (opt-out for local debugging only)

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
