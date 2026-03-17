import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import * as repo from "./repository.js";

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : [];
  const dedup = new Set();

  for (const raw of values) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t) continue;
    if (!/^[a-z0-9_-]{1,32}$/.test(t)) {
      throw new DomainError("validation_error", "tags must match ^[a-z0-9_-]{1,32}$");
    }
    dedup.add(t);
  }

  if (dedup.size > 32) {
    throw new DomainError("validation_error", "a user can have at most 32 tags");
  }

  return [...dedup];
}

export async function listUsers() {
  return repo.listUsers(pool);
}

export async function deleteUser({ userId, actorUserId }) {
  const user = await repo.findUserById(pool, userId);
  if (!user) {
    throw new DomainError("not_found");
  }

  if (user.is_admin) {
    const admins = await repo.countAdmins(pool);
    if (admins <= 1) {
      throw new DomainError("last_admin");
    }
  }

  await repo.deleteUserById(pool, userId);
  return { deletedSelf: userId === actorUserId };
}

export async function setUserTags({ userId, tags }) {
  const normalizedTags = normalizeTags(tags);
  const updated = await repo.updateUserTags(pool, { userId, tags: normalizedTags });

  if (!updated) {
    throw new DomainError("not_found");
  }

  return updated;
}

export async function approveUser({ userId }) {
  const updated = await repo.approveUserById(pool, userId);
  if (!updated) {
    throw new DomainError("not_found");
  }

  return updated;
}

export async function listBoards() {
  return repo.listBoards(pool);
}

export async function createBoard({ slug, name }) {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  const normalizedName = String(name ?? "").trim();

  if (!/^[a-z0-9]{1,20}$/.test(normalizedSlug)) {
    throw new DomainError("validation_error", "slug must match ^[a-z0-9]{1,20}$");
  }

  if (!normalizedName || normalizedName.length > 100) {
    throw new DomainError("validation_error", "name is required and must be at most 100 chars");
  }

  try {
    return await repo.insertBoard(pool, { slug: normalizedSlug, name: normalizedName });
  } catch (err) {
    if (err && typeof err === "object" && err.code === "23505") {
      throw new DomainError("already_exists");
    }
    throw err;
  }
}

export async function deleteBoard({ slug }) {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();

  try {
    const deleted = await repo.deleteBoardBySlug(pool, normalizedSlug);
    if (!deleted) {
      throw new DomainError("not_found");
    }
  } catch (err) {
    if (err && typeof err === "object" && err.code === "23503") {
      throw new DomainError("board_not_empty");
    }
    throw err;
  }
}
