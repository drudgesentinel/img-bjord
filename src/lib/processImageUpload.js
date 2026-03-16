import sharp from "sharp";
import { DomainError } from "./domainErrors.js";
import { saveImageAvif } from "./mediaStorage.js";

const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const AVIF_QUALITY = Number(process.env.AVIF_QUALITY ?? 50);
const AVIF_EFFORT = Number(process.env.AVIF_EFFORT ?? 4);

export async function processImageUpload(file) {
  if (!file) return null;

  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    throw new DomainError("validation_error", "Uploaded file must be an image");
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new DomainError("validation_error", "Image exceeds maximum allowed size");
  }

  const { data, info } = await sharp(file.buffer)
    .rotate()
    .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
    .toBuffer({ resolveWithObject: true });

  const stored = await saveImageAvif(data);

  return {
    imageUrl: stored.url,
    imageMimeType: "image/avif",
    imageSizeBytes: info.size ?? data.length,
    imageWidth: info.width ?? null,
    imageHeight: info.height ?? null,
  };
}
