import { and, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { deleteUserSessions } from "../auth/auth.service";

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const userColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export async function listUsers(
  page: number,
  pageSize: number,
  search?: string,
  activeOnly?: boolean,
): Promise<{ data: UserRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(users.username, `%${search}%`), ilike(users.displayName, `%${search}%`)),
    );
  }
  if (activeOnly) {
    conditions.push(eq(users.isActive, true));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(users).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "user";
}): Promise<UserRow> {
  const passwordHash = await Bun.password.hash(input.password, "argon2id");

  const result = await db
    .insert(users)
    .values({
      username: input.username,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
    })
    .returning(userColumns);

  return result[0];
}

export async function updateUser(
  id: string,
  input: { displayName?: string; role?: "admin" | "user" },
): Promise<UserRow> {
  const result = await db
    .update(users)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning(userColumns);

  if (result.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return result[0];
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = await Bun.password.hash(newPassword, "argon2id");

  const result = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (result.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  await deleteUserSessions(id);
}

export async function changePassword(
  id: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const result = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const user = result[0];
  if (!user?.passwordHash) {
    throw new Error("USER_NOT_FOUND");
  }

  const valid = await Bun.password.verify(oldPassword, user.passwordHash);
  if (!valid) {
    throw new Error("WRONG_PASSWORD");
  }

  const passwordHash = await Bun.password.hash(newPassword, "argon2id");
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function toggleUserStatus(id: string): Promise<UserRow> {
  // First get the current user
  const current = await db
    .select({ id: users.id, isActive: users.isActive, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const user = current[0];
  const newIsActive = !user.isActive;

  // Prevent deactivating the last active admin
  if (!newIsActive && user.role === "admin") {
    const activeAdmins = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, id)));

    if ((activeAdmins[0]?.count ?? 0) === 0) {
      throw new Error("LAST_ACTIVE_ADMIN");
    }
  }

  const result = await db
    .update(users)
    .set({ isActive: newIsActive, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(userColumns);

  // When disabling, delete all sessions for immediate revocation
  if (!newIsActive) {
    await deleteUserSessions(id);
  }

  return result[0];
}
