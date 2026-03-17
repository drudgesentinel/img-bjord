This is an image board written in Javascript.

The goal is to make it easy to host, and easy to use.

.env should contain your DB URL, something like:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard

For tests, use a separate database as tests will blow out db contents:
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard_test

Also supported for compatibility in tests: `TEST_DATABASE` or `DATABASE_URL_TEST`.

You can do basic configuration of the board at:
frontend/src/lib/siteConfig.ts

At some point, I'm going to add additional options here. idk what.

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

You need podman installed for things to work out of the box

`./bjdev db up` now initializes both `imageboard` and `imageboard_test` databases and applies `db/schema.sql` to each.

