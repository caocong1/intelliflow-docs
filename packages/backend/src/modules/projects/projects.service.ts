import { and, count, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { projectMembers, projects, users } from "../../db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  createdBy: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectListItem = ProjectRow & {
  memberCount: number;
  userRole: "owner" | "participant" | null;
};

type MemberRow = {
  id: string;
  projectId: string;
  userId: string;
  role: "owner" | "participant";
  joinedAt: Date;
  displayName: string;
  username: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, "owner"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);
  return rows.length > 0;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  body: { name: string; description?: string; department?: string },
) {
  return await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        name: body.name,
        description: body.description ?? null,
        department: body.department ?? null,
        createdBy: userId,
      })
      .returning();

    // Auto-insert creator as owner
    await tx.insert(projectMembers).values({
      projectId: project.id,
      userId,
      role: "owner",
    });

    return { ...project, memberCount: 1 };
  });
}

export async function listProjects(
  userId: string,
  tab: "created" | "joined" | "all",
  page: number,
  pageSize: number,
  search?: string,
): Promise<{ data: ProjectListItem[]; total: number }> {
  const offset = (page - 1) * pageSize;

  // Build the membership subquery for memberCount
  const memberCountSq = db
    .select({
      projectId: projectMembers.projectId,
      cnt: count().as("cnt"),
    })
    .from(projectMembers)
    .groupBy(projectMembers.projectId)
    .as("mc");

  // Build the userRole subquery
  const userRoleSq = db
    .select({
      projectId: projectMembers.projectId,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .as("ur");

  // Base conditions: not deleted
  const conditions = [eq(projects.isDeleted, false)];

  // Search filter
  if (search) {
    conditions.push(ilike(projects.name, `%${search}%`));
  }

  // Tab filter
  if (tab === "created") {
    conditions.push(eq(projects.createdBy, userId));
  }

  // For "joined" tab, we need projects where user is a member but NOT the creator
  // We'll handle this by joining with projectMembers
  if (tab === "joined") {
    // Use a subquery approach: get project IDs where user is member but not creator
    const memberProjectIds = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));

    conditions.push(
      sql`${projects.id} IN (${memberProjectIds})`,
    );
    conditions.push(ne(projects.createdBy, userId));
  }

  const whereClause = and(...conditions);

  // Count query
  const [{ total }] = await db
    .select({ total: count() })
    .from(projects)
    .where(whereClause);

  // Data query with joins for memberCount and userRole
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      department: projects.department,
      createdBy: projects.createdBy,
      isDeleted: projects.isDeleted,
      deletedAt: projects.deletedAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      memberCount: sql<number>`COALESCE(${memberCountSq.cnt}, 0)`.as("member_count"),
      userRole: sql<"owner" | "participant" | null>`${userRoleSq.role}`.as("user_role"),
    })
    .from(projects)
    .leftJoin(memberCountSq, eq(projects.id, memberCountSq.projectId))
    .leftJoin(userRoleSq, eq(projects.id, userRoleSq.projectId))
    .where(whereClause)
    .orderBy(desc(projects.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data: rows as ProjectListItem[], total };
}

export async function getProject(projectId: string, userId: string) {
  const memberCountSq = db
    .select({
      projectId: projectMembers.projectId,
      cnt: count().as("cnt"),
    })
    .from(projectMembers)
    .groupBy(projectMembers.projectId)
    .as("mc");

  const userRoleSq = db
    .select({
      projectId: projectMembers.projectId,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .as("ur");

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      department: projects.department,
      createdBy: projects.createdBy,
      isDeleted: projects.isDeleted,
      deletedAt: projects.deletedAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      memberCount: sql<number>`COALESCE(${memberCountSq.cnt}, 0)`.as("member_count"),
      userRole: sql<"owner" | "participant" | null>`${userRoleSq.role}`.as("user_role"),
    })
    .from(projects)
    .leftJoin(memberCountSq, eq(projects.id, memberCountSq.projectId))
    .leftJoin(userRoleSq, eq(projects.id, userRoleSq.projectId))
    .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateProject(
  projectId: string,
  body: { name?: string; description?: string; department?: string },
) {
  const [updated] = await db
    .update(projects)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return updated ?? null;
}

export async function deleteProject(projectId: string) {
  const [deleted] = await db
    .update(projects)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return deleted ?? null;
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(projectId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
      displayName: users.displayName,
      username: users.username,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(projectMembers.joinedAt);

  return rows;
}

export async function addMember(
  projectId: string,
  userId: string,
  role: "owner" | "participant" = "participant",
) {
  // Check if already a member
  const existing = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("ALREADY_MEMBER");
  }

  const [member] = await db
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .returning();

  return member;
}

export async function removeMember(projectId: string, userId: string) {
  // Cannot remove if user is the sole owner
  const member = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (member.length === 0) {
    throw new Error("NOT_A_MEMBER");
  }

  if (member[0].role === "owner") {
    const ownerCount = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, "owner")),
      );

    if ((ownerCount[0]?.count ?? 0) <= 1) {
      throw new Error("SOLE_OWNER");
    }
  }

  await db
    .delete(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    );
}

export async function leaveProject(projectId: string, userId: string) {
  // Same logic as removeMember but self-initiated
  await removeMember(projectId, userId);
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: "owner" | "participant",
) {
  // If demoting from owner, check not sole owner
  if (role === "participant") {
    const current = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      )
      .limit(1);

    if (current.length > 0 && current[0].role === "owner") {
      const ownerCount = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.role, "owner"),
          ),
        );

      if ((ownerCount[0]?.count ?? 0) <= 1) {
        throw new Error("SOLE_OWNER");
      }
    }
  }

  const [updated] = await db
    .update(projectMembers)
    .set({ role })
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .returning();

  if (!updated) {
    throw new Error("NOT_A_MEMBER");
  }

  return updated;
}
