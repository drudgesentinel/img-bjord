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
  "gentle",
  "ragged",
  "plague",
  "one eyed",
  "punished",
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
  "bangus",
  "ak47",
  "a10_warthog",
  "paladin",
  "wastrel",
  "sliver",
  "wretch",
];

export function slugifySubject(subject) {
  if (!subject) return "thread";
  const s = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 60);

  return s || "thread";
}

/**
 * Generates a readable token like "bangus_enchilada".
 * This is the stable identifier used in the URL.
 */
export function makeThreadToken() {
  const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(0, NOUNS.length)];
  return `${adj}_${noun}`; // lowercase + underscore
}

export function normalizeToken(token) {
  return String(token).toLowerCase();
}

export function isUniqueViolation(err) {
  return err && typeof err === "object" && err.code === "23505";
}
