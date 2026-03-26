import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { notifications } from "../../db/schema";

// ─── Notification Service ────────────────────────────────────────────────────

/**
 * Create an in-app notification for a user.
 */
export async function createNotification(params: {
  userId: string;
  type: "generation_completed" | "generation_failed";
  title: string;
  message?: string;
  documentId?: string;
  projectId?: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      documentId: params.documentId ?? null,
      projectId: params.projectId ?? null,
    })
    .returning();

  return notification;
}

/**
 * Get paginated notifications for a user, newest first.
 */
export async function getNotifications(
  userId: string,
  opts?: { limit?: number; offset?: number },
) {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
  ]);

  return { notifications: rows, total: totalRow?.count ?? 0 };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
      ),
    );

  return { count: row?.count ?? 0 };
}

/**
 * Mark a single notification as read (only if owned by user).
 */
export async function markRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllRead(userId: string) {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
      ),
    )
    .returning({ id: notifications.id });

  return { updated: result.length };
}
