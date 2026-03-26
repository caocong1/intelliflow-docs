import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  documents,
  projects,
  userFavorites,
  userRecentAccess,
  workflows,
} from "../../db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetType = "project" | "document" | "workflow";

interface FavoriteItem {
  id: string;
  targetId: string;
  targetType: TargetType;
  name: string;
  createdAt: Date;
}

interface RecentAccessItem {
  id: string;
  targetId: string;
  targetType: TargetType;
  name: string;
  accessedAt: Date;
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function toggleFavorite(
  userId: string,
  targetType: TargetType,
  targetId: string,
): Promise<{ favorited: boolean }> {
  // Check if exists
  const existing = await db
    .select({ id: userFavorites.id })
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.targetType, targetType),
        eq(userFavorites.targetId, targetId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(userFavorites).where(eq(userFavorites.id, existing[0].id));
    return { favorited: false };
  }

  await db.insert(userFavorites).values({ userId, targetType, targetId });
  return { favorited: true };
}

export async function listFavorites(userId: string): Promise<{
  projects: FavoriteItem[];
  documents: FavoriteItem[];
  workflows: FavoriteItem[];
}> {
  const rows = await db
    .select({
      id: userFavorites.id,
      targetId: userFavorites.targetId,
      targetType: userFavorites.targetType,
      createdAt: userFavorites.createdAt,
    })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));

  const result: { projects: FavoriteItem[]; documents: FavoriteItem[]; workflows: FavoriteItem[] } = {
    projects: [],
    documents: [],
    workflows: [],
  };

  // Group by type and resolve names
  const projectIds = rows.filter((r) => r.targetType === "project").map((r) => r.targetId);
  const documentIds = rows.filter((r) => r.targetType === "document").map((r) => r.targetId);
  const workflowIds = rows.filter((r) => r.targetType === "workflow").map((r) => r.targetId);

  // Batch-fetch target names
  const [projectNames, documentNames, workflowNames] = await Promise.all([
    projectIds.length > 0
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
      : Promise.resolve([]),
    documentIds.length > 0
      ? db.select({ id: documents.id, name: documents.title }).from(documents).where(inArray(documents.id, documentIds))
      : Promise.resolve([]),
    workflowIds.length > 0
      ? db.select({ id: workflows.id, name: workflows.name }).from(workflows).where(inArray(workflows.id, workflowIds))
      : Promise.resolve([]),
  ]);

  const nameMap = new Map<string, string>();
  for (const p of projectNames) nameMap.set(p.id, p.name);
  for (const d of documentNames) nameMap.set(d.id, d.name);
  for (const w of workflowNames) nameMap.set(w.id, w.name);

  for (const row of rows) {
    const name = nameMap.get(row.targetId);
    if (!name) continue; // Target deleted — filter out
    const item: FavoriteItem = {
      id: row.id,
      targetId: row.targetId,
      targetType: row.targetType,
      name,
      createdAt: row.createdAt,
    };
    if (row.targetType === "project") result.projects.push(item);
    else if (row.targetType === "document") result.documents.push(item);
    else result.workflows.push(item);
  }

  return result;
}

export async function checkFavorites(
  userId: string,
  items: Array<{ targetType: TargetType; targetId: string }>,
): Promise<string[]> {
  if (items.length === 0) return [];

  // Build OR conditions for each item
  const conditions = items.map((item) =>
    and(eq(userFavorites.targetType, item.targetType), eq(userFavorites.targetId, item.targetId)),
  );

  const rows = await db
    .select({
      targetType: userFavorites.targetType,
      targetId: userFavorites.targetId,
    })
    .from(userFavorites)
    .where(and(eq(userFavorites.userId, userId), sql`(${sql.join(conditions, sql` OR `)})`));

  return rows.map((r) => `${r.targetType}:${r.targetId}`);
}

// ─── Recent Access ───────────────────────────────────────────────────────────

export async function recordAccess(
  userId: string,
  targetType: TargetType,
  targetId: string,
): Promise<{ recorded: true }> {
  // Upsert: insert or update accessedAt on conflict
  await db
    .insert(userRecentAccess)
    .values({ userId, targetType, targetId, accessedAt: new Date() })
    .onConflictDoUpdate({
      target: [userRecentAccess.userId, userRecentAccess.targetType, userRecentAccess.targetId],
      set: { accessedAt: new Date() },
    });

  // Evict oldest beyond 20-record cap
  const overflow = await db
    .select({ id: userRecentAccess.id })
    .from(userRecentAccess)
    .where(eq(userRecentAccess.userId, userId))
    .orderBy(desc(userRecentAccess.accessedAt))
    .offset(20);

  if (overflow.length > 0) {
    await db
      .delete(userRecentAccess)
      .where(inArray(userRecentAccess.id, overflow.map((r) => r.id)));
  }

  return { recorded: true };
}

export async function listRecentAccess(
  userId: string,
  limit = 20,
): Promise<RecentAccessItem[]> {
  const rows = await db
    .select({
      id: userRecentAccess.id,
      targetId: userRecentAccess.targetId,
      targetType: userRecentAccess.targetType,
      accessedAt: userRecentAccess.accessedAt,
    })
    .from(userRecentAccess)
    .where(eq(userRecentAccess.userId, userId))
    .orderBy(desc(userRecentAccess.accessedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  // Batch-fetch target names
  const projectIds = rows.filter((r) => r.targetType === "project").map((r) => r.targetId);
  const documentIds = rows.filter((r) => r.targetType === "document").map((r) => r.targetId);
  const workflowIds = rows.filter((r) => r.targetType === "workflow").map((r) => r.targetId);

  const [projectNames, documentNames, workflowNames] = await Promise.all([
    projectIds.length > 0
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
      : Promise.resolve([]),
    documentIds.length > 0
      ? db.select({ id: documents.id, name: documents.title }).from(documents).where(inArray(documents.id, documentIds))
      : Promise.resolve([]),
    workflowIds.length > 0
      ? db.select({ id: workflows.id, name: workflows.name }).from(workflows).where(inArray(workflows.id, workflowIds))
      : Promise.resolve([]),
  ]);

  const nameMap = new Map<string, string>();
  for (const p of projectNames) nameMap.set(p.id, p.name);
  for (const d of documentNames) nameMap.set(d.id, d.name);
  for (const w of workflowNames) nameMap.set(w.id, w.name);

  // Filter out deleted targets
  return rows
    .map((row) => {
      const name = nameMap.get(row.targetId);
      if (!name) return null;
      return {
        id: row.id,
        targetId: row.targetId,
        targetType: row.targetType,
        name,
        accessedAt: row.accessedAt,
      };
    })
    .filter((item): item is RecentAccessItem => item !== null);
}
