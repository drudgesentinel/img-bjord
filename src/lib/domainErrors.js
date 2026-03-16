export class DomainError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(err, code) {
  if (!err || typeof err !== "object") return false;
  if (!("code" in err)) return false;
  if (!code) return true;
  return err.code === code;
}
