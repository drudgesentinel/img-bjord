import bcrypt from "bcryptjs";
import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import { makeGeneratedUsername, isUniqueViolation } from "../../lib/threadSlug.js";
import * as repo from "./repository.js";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function assertPassword(password) {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    throw new DomainError("validation_error", `password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  }

  return value;
}

export async function registerUserWithGeneratedUsername({ password }) {
  const normalizedPassword = assertPassword(password);
  const passwordHash = await bcrypt.hash(normalizedPassword, 12);

  for (let attempt = 0; attempt < 24; attempt++) {
    const username = makeGeneratedUsername();

    try {
      const user = await repo.insertUser(pool, { username, passwordHash });
      return user;
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  throw new DomainError("username_generation_failed");
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

  const user = await repo.findUserAuthByUsername(pool, normalizedUsername);
  if (!user) {
    throw new DomainError("invalid_credentials");
  }

  const ok = await bcrypt.compare(normalizedPassword, user.password_hash);
  if (!ok) {
    throw new DomainError("invalid_credentials");
  }

  return {
    id: user.id,
    username: user.username,
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
