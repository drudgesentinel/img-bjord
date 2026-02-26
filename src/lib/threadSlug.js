import crypto from "node:crypto";

const ADJECTIVES = [
  "wretched",
  "silent",
  "burning",
  "frozen",
  "cursed",
  "shiny",
  "crimson",
  "lonely",
  "ancient",
  "furious",
  "bangus",
];

const NOUNS = [
  "enchilada",
  "owl",
  "hammer",
  "ghost",
  "dragon",
  "pickle",
  "falcon",
  "lantern",
  "anvil",
  "comet",
];

function randomInt(max) {
  // crypto-safe selection
  return crypto.randomInt(0, max);
}

function pick(arr) {
  return arr[randomInt(arr.length)];
}

export function slugifySubject(subject) {
  if (!subject) return "";
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * Returns a readable token like: bangus_enchilada
 * - lowercase + underscore (URL-safe)
 */
export function makeThreadToken() {
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}`;
}

/**
 * For display in URL path if you want shouting:
 * BANGUS_ENCHILADA
 */
export function formatTokenForUrl(token) {
  return token.toUpperCase();
}

/**
 * Parse incoming token segment in a forgiving way:
 * - allow upper/lower
 * - normalize to lowercase
 */
export function normalizeToken(tokenSegment) {
  return tokenSegment.toLowerCase();
}

export function isUniqueViolation(err) {
  return err && typeof err === "object" && err.code === "23505";
}
