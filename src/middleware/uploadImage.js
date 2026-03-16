import multer from "multer";

const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 10 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_UPLOAD_BYTES,
    files: 1,
  },
});

export function uploadOptionalImage(fieldName = "image") {
  const middleware = upload.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();

      const message = err?.message || "invalid_upload";
      return res.status(400).json({
        error: "validation_error",
        details: {
          formErrors: [message],
          fieldErrors: {
            [fieldName]: [message],
          },
        },
      });
    });
  };
}
