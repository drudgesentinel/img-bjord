import bcrypt from "bcryptjs";
import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import {
  getAllGeneratedUsernameCombos,
  getAllGeneratedUsernameSingles,
  getAllGeneratedUsernames,
  reverseGeneratedUsernameOrder,
} from "../../lib/usernameGenerator.js";
import { isUniqueViolation } from "../../lib/threadSlug.js";
import { withTransaction } from "../../lib/withTransaction.js";
import * as repo from "./repository.js";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const ALL_GENERATED_USERNAMES = getAllGeneratedUsernames();
const ALL_GENERATED_USERNAME_SINGLES = getAllGeneratedUsernameSingles();
const ALL_GENERATED_USERNAME_COMBOS = getAllGeneratedUsernameCombos();

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function assertRegistrationUsername(username) {
  const value = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,64}$/.test(value)) {
    throw new DomainError("validation_error", "username must match ^[a-z0-9_]{3,64}$");
  }

  return value;
}

function assertPassword(password) {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    throw new DomainError("validation_error", `password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  }

  return value;
}

function assertActivationCode(activationCode) {
  const value = String(activationCode ?? "").trim();
  if (!value) {
    return null;
  }

  if (value.length < 3 || value.length > 500) {
    throw new DomainError("validation_error", "activation message must be 3-500 characters");
  }

  return value;
}

export async function registerUserWithGeneratedUsername({ password, username, activationCode }) {
  const normalizedPassword = assertPassword(password);
  const normalizedActivationCode = assertActivationCode(activationCode);
  const passwordHash = await bcrypt.hash(normalizedPassword, 12);
  const requestedUsername = typeof username === "string" && username.trim() ? assertRegistrationUsername(username) : null;

  if (requestedUsername && !ALL_GENERATED_USERNAMES.includes(requestedUsername)) {
    throw new DomainError("validation_error", "username must be selected from generated options");
  }

  return withTransaction(pool, async (client) => {
    const existingUsers = await repo.countUsers(client);
    const isFirstUser = existingUsers === 0;

    let usernameToUse = requestedUsername;
    if (!usernameToUse) {
      const [generated] = await getRegistrationUsernameCandidates(1, client);
      usernameToUse = generated;
    }

    try {
      await repo.markUsernameConsumed(client, usernameToUse);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError("username_taken", "username already taken");
      }
      throw err;
    }

    return repo.insertUser(client, {
      username: usernameToUse,
      passwordHash,
      activationCode: normalizedActivationCode,
      isApproved: isFirstUser,
      isAdmin: isFirstUser,
    });
  });
}

export async function getRegistrationUsernameCandidates(count = 5, db = pool) {
  const targetCount = Number.isInteger(count) ? count : 5;
  const desired = Math.max(1, Math.min(10, targetCount));
  const unavailable = new Set(await repo.listUnavailableUsernames(db));

  let singles = ALL_GENERATED_USERNAME_SINGLES.filter((username) => !unavailable.has(username));
  let combos = ALL_GENERATED_USERNAME_COMBOS.filter(
    (username) => !unavailable.has(username) && !ALL_GENERATED_USERNAME_SINGLES.includes(username),
  );

  const singlesDesired = Math.floor(desired / 2);
  const combosDesired = desired - singlesDesired;

  if (singles.length < singlesDesired || combos.length < combosDesired) {
    throw new DomainError("username_generation_failed", "Increase threadSlug nouns and adjectives");
  }

  // random sample without replacement
  for (let i = singles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [singles[i], singles[j]] = [singles[j], singles[i]];
  }

  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }

  const selected = [...singles.slice(0, singlesDesired), ...combos.slice(0, combosDesired)];
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected;
}

export async function reverseRegistrationUsernameCandidate(username, db = pool) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    throw new DomainError("validation_error", "username is required");
  }

  const reversed = reverseGeneratedUsernameOrder(normalized);
  if (!reversed) return null;

  const unavailable = new Set(await repo.listUnavailableUsernames(db));
  if (unavailable.has(reversed)) return null;

  if (!ALL_GENERATED_USERNAMES.includes(reversed)) return null;
  return reversed;
}

export async function loginUser({ username, password }) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    throw new DomainError("validation_error", "username is required");
  }

  const normalizedPassword = String(password ?? "");
  if (!normalizedPassword) {
    throw new DomainError("validation_error", "password is required");
  }

  let user = await repo.findUserAuthByUsername(pool, normalizedUsername);
  if (!user && !/_\d{4}$/.test(normalizedUsername)) {
    const candidates = await repo.findUserAuthByDisplayUsername(pool, normalizedUsername);
    if (candidates.length === 1) {
      user = candidates[0];
    }
  }

  if (!user) {
    throw new DomainError("invalid_credentials");
  }

  if (!user.is_approved) {
    throw new DomainError("account_pending_approval");
  }

  const ok = await bcrypt.compare(normalizedPassword, user.password_hash);
  if (!ok) {
    throw new DomainError("invalid_credentials");
  }

  return {
    id: user.id,
    username: user.username,
    is_approved: user.is_approved,
    is_admin: user.is_admin,
    tags: user.tags,
    created_at: user.created_at,
  };
}

export async function getSessionUser(userId) {
  const user = await repo.findUserPublicById(pool, userId);
  if (!user) {
    throw new DomainError("not_found");
  }

  return user;
}
