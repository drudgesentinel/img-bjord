import multer from "multer";
import fs from "node:fs";
import path from "node:path";

const MAX_MEDIA_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 100 * 1024 * 1024);
const tempUploadDir = path.resolve(process.env.TEMP_UPLOAD_DIR ?? "data/tmp-uploads");

fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempUploadDir),
  }),
  limits: {
    fileSize: MAX_MEDIA_UPLOAD_BYTES,
    files: 1,
  },
});

export function uploadOptionalMedia(fieldName = "image") {
  const middleware = upload.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();

      const isTooLarge = err?.code === "LIMIT_FILE_SIZE";
      const message = err?.message || "invalid_upload";

      return res.status(isTooLarge ? 413 : 400).json({
        error: "validation_error",
        details: {
          formErrors: [
            isTooLarge
              ? `Upload exceeds maximum allowed size (${MAX_MEDIA_UPLOAD_BYTES} bytes)`
              : message,
          ],
          fieldErrors: {
            [fieldName]: [
              isTooLarge
                ? `Upload exceeds maximum allowed size (${MAX_MEDIA_UPLOAD_BYTES} bytes)`
                : message,
            ],
          },
        },
      });
    });
  };
}

export const uploadOptionalImage = uploadOptionalMedia;
