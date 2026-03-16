This is an image board written in Javascript.

The goal is to make it easy to host, and easy to use.

.env should contain your DB URL, something like:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imageboard

Image/media envs:
- MEDIA_STORAGE_DRIVER=local (default) or s3 (scaffold)
- MAX_IMAGE_UPLOAD_BYTES=10485760
- AVIF_QUALITY=50
- AVIF_EFFORT=4
- UPLOAD_DIR=data/uploads (local)
- UPLOAD_PUBLIC_PREFIX=/api/uploads (local)

S3 scaffold envs (for future wiring):
- S3_ENDPOINT
- S3_BUCKET
- S3_REGION
- S3_KEY_PREFIX=posts
- S3_PUBLIC_BASE_URL

You need podman installed for things to work out of the box
