import crypto from "node:crypto";

const USERNAME_ADJECTIVES = [
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
  "grim",
  "warmonger",
  "overpowered",
  "gold plated",
  "golden",
  "pain",
  "forever",
  "forbidden",
  "void",
  "bearer of the",
  "dauthi",
  "bad moon",
  "war criminal",
  "kinslayer",
  "north hollywood",
  "west side",
  "boneyard",
  "bone",
  "decadent",
  "sacrificial",
  "the blind",
  "aspect of the",
];

const USERNAME_NOUNS = [
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
  "villain",
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
  "blasphemer",
  "swordsman",
  "hierophant",
  "tyrant",
  "war machine",
  "curse",
  "plague sun",
  "ghoul",
  "death machine",
  "sorrow",
];

const THREAD_ADJECTIVES = [
  "daily",
  "general",
  "helpful",
  "curious",
  "focused",
  "practical",
  "modern",
  "classic",
  "open",
  "casual",
  "serious",
  "creative",
  "quick",
  "deep",
  "friendly",
  "simple",
  "advanced",
  "local",
  "global",
  "timely",
];

const THREAD_NOUNS = [
  "discussion",
  "topic",
  "question",
  "answer",
  "guide",
  "review",
  "update",
  "project",
  "idea",
  "request",
  "report",
  "plan",
  "design",
  "workflow",
  "notes",
  "feedback",
  "strategy",
  "example",
  "summary",
  "thread",
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
 * Generates a readable token like "daily_topic".
 * This is the stable identifier used in the URL.
 */
export function makeThreadToken() {
  const adj = THREAD_ADJECTIVES[crypto.randomInt(0, THREAD_ADJECTIVES.length)];
  const noun = THREAD_NOUNS[crypto.randomInt(0, THREAD_NOUNS.length)];
  return `${adj}_${noun}`;
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
  const adj = USERNAME_ADJECTIVES[crypto.randomInt(0, USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[crypto.randomInt(0, USERNAME_NOUNS.length)];
  const handle = `${sanitizeSlugPart(adj)}_${sanitizeSlugPart(noun)}`;
  return handle || "anon_user";
}

export function getAllGeneratedUsernameSingles() {
  const all = [];

  for (const adj of USERNAME_ADJECTIVES) {
    const handle = sanitizeSlugPart(adj);
    if (handle) all.push(handle);
  }

  for (const noun of USERNAME_NOUNS) {
    const handle = sanitizeSlugPart(noun);
    if (handle) all.push(handle);
  }

  return [...new Set(all)];
}

export function getAllGeneratedUsernameCombos() {
  const all = [];

  for (const adj of USERNAME_ADJECTIVES) {
    for (const noun of USERNAME_NOUNS) {
      const handle = `${sanitizeSlugPart(adj)}_${sanitizeSlugPart(noun)}`;
      if (handle) all.push(handle);
    }
  }

  return [...new Set(all)];
}

export function getAllGeneratedUsernames() {
  return [...new Set([...getAllGeneratedUsernameSingles(), ...getAllGeneratedUsernameCombos()])];
}

export function normalizeToken(token) {
  return String(token).toLowerCase();
}

export function isUniqueViolation(err) {
  return err && typeof err === "object" && err.code === "23505";
}
