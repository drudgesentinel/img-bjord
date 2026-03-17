import crypto from "node:crypto";

const USERNAME_ADJECTIVES = [
  "bleak",
  "dread",
  "dark",
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
  "anor londo",
  "harbinger",
  "moon of the",
  "son of the",
  "keeper of the",
  "demon",
  "watcher of the",
  "heartbreak",
  "yung",
  "ancient of the",
  "knight of the",
];

const USERNAME_NOUNS = [
  "lighthouse",
  "jailer",
  "tormentor",
  "enchilada",
  "warhorse",
  "warlord",
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
  "chemical",
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
  "black knight",
  "gunman",
  "mothman",
  "wanderer",
  "darkness",
  "ennui",
  "knight",
  "inheritance",
  "watcher",
  "sentinel",
  "dreamer",
  "cult",
  "machine",
];

function sanitizeSlugPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function canAppearSecondInReversedUsername(adjective) {
  return !String(adjective ?? "").trim().toLowerCase().endsWith("of the");
}

function canAppearAsStandaloneUsername(adjective) {
  return canAppearSecondInReversedUsername(adjective);
}

export function makeGeneratedUsername() {
  const adj = USERNAME_ADJECTIVES[crypto.randomInt(0, USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[crypto.randomInt(0, USERNAME_NOUNS.length)];
  const useReversedOrder = canAppearSecondInReversedUsername(adj) && crypto.randomInt(0, 2) === 1;
  const handle = useReversedOrder
    ? `${sanitizeSlugPart(noun)}_${sanitizeSlugPart(adj)}`
    : `${sanitizeSlugPart(adj)}_${sanitizeSlugPart(noun)}`;
  return handle || "anon_user";
}

export function getAllGeneratedUsernameSingles() {
  const all = [];

  for (const adj of USERNAME_ADJECTIVES) {
    const handle = sanitizeSlugPart(adj);
    if (canAppearAsStandaloneUsername(adj) && handle) all.push(handle);
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
      const adjectiveThenNoun = `${sanitizeSlugPart(adj)}_${sanitizeSlugPart(noun)}`;
      const nounThenAdjective = `${sanitizeSlugPart(noun)}_${sanitizeSlugPart(adj)}`;
      if (adjectiveThenNoun) all.push(adjectiveThenNoun);
      if (canAppearSecondInReversedUsername(adj) && nounThenAdjective) all.push(nounThenAdjective);
    }
  }

  return [...new Set(all)];
}

export function reverseGeneratedUsernameOrder(username) {
  const value = sanitizeSlugPart(username);
  if (!value || !value.includes("_")) return null;

  for (const adj of USERNAME_ADJECTIVES) {
    const adjPart = sanitizeSlugPart(adj);
    for (const noun of USERNAME_NOUNS) {
      const nounPart = sanitizeSlugPart(noun);
      const adjectiveThenNoun = `${adjPart}_${nounPart}`;
      const nounThenAdjective = `${nounPart}_${adjPart}`;

      if (value === adjectiveThenNoun) {
        if (!canAppearSecondInReversedUsername(adj)) return null;
        return nounThenAdjective;
      }

      if (value === nounThenAdjective) {
        if (!canAppearSecondInReversedUsername(adj)) return null;
        return adjectiveThenNoun;
      }
    }
  }

  return null;
}

export function getAllGeneratedUsernames() {
  return [...new Set([...getAllGeneratedUsernameSingles(), ...getAllGeneratedUsernameCombos()])];
}
