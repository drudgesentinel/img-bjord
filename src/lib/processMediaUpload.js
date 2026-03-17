import sharp from "sharp";
import { DomainError } from "./domainErrors.js";
import { saveImageAvif, saveMediaFile } from "./mediaStorage.js";

const MAX_MEDIA_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const AVIF_QUALITY = Number(process.env.AVIF_QUALITY ?? 50);
const AVIF_EFFORT = Number(process.env.AVIF_EFFORT ?? 4);

const VIDEO_MIME_TO_EXTENSION = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

async function processImageMedia(file) {
  const { data, info } = await sharp(file.buffer)
    .rotate()
    .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
    .toBuffer({ resolveWithObject: true });

  const stored = await saveImageAvif(data);

  return {
    mediaType: "image",
    mediaUrl: stored.url,
    mediaMimeType: "image/avif",
    mediaSizeBytes: info.size ?? data.length,
    mediaWidth: info.width ?? null,
    mediaHeight: info.height ?? null,
    mediaDurationSec: null,
  };
}

async function processVideoMedia(file) {
  const extension = VIDEO_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) {
    throw new DomainError("validation_error", "Uploaded video must be MP4 or WebM");
  }

  const stored = await saveMediaFile(file.buffer, extension);

  return {
    mediaType: "video",
    mediaUrl: stored.url,
    mediaMimeType: file.mimetype,
    mediaSizeBytes: file.size ?? file.buffer?.length ?? null,
    mediaWidth: null,
    mediaHeight: null,
    mediaDurationSec: null,
  };
}

export async function processMediaUpload(file) {
  if (!file) return null;

  if (!file.mimetype) {
    throw new DomainError("validation_error", "Uploaded file must be an image, MP4, or WebM video");
  }

  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new DomainError("validation_error", "Upload exceeds maximum allowed size");
  }

  if (file.mimetype.startsWith("image/")) {
    return processImageMedia(file);
  }

  if (file.mimetype in VIDEO_MIME_TO_EXTENSION) {
    return processVideoMedia(file);
  }

  throw new DomainError("validation_error", "Uploaded file must be an image, MP4, or WebM video");
}
