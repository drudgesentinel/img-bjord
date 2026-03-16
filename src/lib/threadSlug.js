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
  "scourged",
  "bilious",
  "vile",
  "dire",
  "forsaken",
  "feeble",
  "overpowered",
  "nerfed",
  "golden",
  "pain",
  "forever",
  "forbidden",
  "void",
  "knight of the",
  "bearer of the",
];

const NOUNS = [
  "enchilada",
  "owl",
  "hammer",
  "ghost",
  "dragon",
  "pickle",
  "crow",
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
  "god",
  "keep",
  "moth",
  "widower",
  "cursed one",
  "maiden",
  "demise",
  "seer",
  "wasteland",
  "chemicals",
  "wizard",
  "blasphemer",
  "apostate",
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

function sanitizeSlugPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

export function makeGeneratedUsername() {
  const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(0, NOUNS.length)];
  const suffix = crypto.randomInt(1000, 10000);
  const handle = `${sanitizeSlugPart(adj)}_${sanitizeSlugPart(noun)}_${suffix}`;
  return handle || `anon_${suffix}`;
}

export function normalizeToken(token) {
  return String(token).toLowerCase();
}

export function isUniqueViolation(err) {
  return err && typeof err === "object" && err.code === "23505";
}
