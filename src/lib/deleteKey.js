import { createHash, randomBytes } from "node:crypto";

export function generateDeleteKey() {
  return randomBytes(16).toString("hex");
}

export function hashDeleteKey(key) {
  return createHash("sha256").update(key).digest("hex");
}
