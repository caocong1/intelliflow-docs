import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
};

export async function validateCredentials(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const user = result[0];
  if (!user || !user.isActive) return null;

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    token,
    userId,
    createdAt: now,
    expiresAt,
  });

  return token;
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)),
    )
    .limit(1);

  return result[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserById(id: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0] ?? null;
}
