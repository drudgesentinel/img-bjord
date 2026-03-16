import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "data/uploads");
const publicPrefix = process.env.UPLOAD_PUBLIC_PREFIX ?? "/api/uploads";
const mediaStorageDriver = (process.env.MEDIA_STORAGE_DRIVER ?? "local").toLowerCase();

function getS3ScaffoldConfig() {
  return {
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    keyPrefix: process.env.S3_KEY_PREFIX ?? "posts",
  };
}

async function saveImageAvifToS3(_buffer) {
  const cfg = getS3ScaffoldConfig();

  if (!cfg.endpoint || !cfg.bucket || !cfg.region) {
    throw new Error(
      "S3 storage selected but S3_ENDPOINT, S3_BUCKET, or S3_REGION is missing",
    );
  }

  throw new Error(
    "S3 media storage scaffold is enabled but upload implementation is not wired yet. Keep MEDIA_STORAGE_DRIVER=local for now.",
  );
}

export async function saveImageAvif(buffer) {
  if (mediaStorageDriver === "s3") {
    return saveImageAvifToS3(buffer);
  }

  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.avif`;
  const absolutePath = path.join(uploadDir, filename);

  await fs.writeFile(absolutePath, buffer);

  return {
    key: filename,
    url: `${publicPrefix}/${filename}`,
  };
}

export function getUploadDir() {
  return uploadDir;
}

export function isLocalMediaStorage() {
  return mediaStorageDriver !== "s3";
}

export function getMediaStorageDriver() {
  return mediaStorageDriver;
}
