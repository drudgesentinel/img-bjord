import crypto from "node:crypto";

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

export function normalizeToken(token) {
  return String(token).toLowerCase();
}

export function isUniqueViolation(err) {
  return err && typeof err === "object" && err.code === "23505";
}
