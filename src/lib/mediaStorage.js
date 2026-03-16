import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "data/uploads");
const publicPrefix = process.env.UPLOAD_PUBLIC_PREFIX ?? "/api/uploads";

export async function saveImageAvif(buffer) {
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.avif`;
  const absolutePath = path.join(uploadDir, filename);

  await fs.writeFile(absolutePath, buffer);

  return {
    key: filename,
    url: `${publicPrefix}/${filename}`,
  };
}

// Future S3-compatible integration can implement this same return contract.
export function getUploadDir() {
  return uploadDir;
}
