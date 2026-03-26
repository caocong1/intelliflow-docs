import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  documents,
  documentVisibilityMembers,
  projectMembers,
  projects,
  workflows,
} from "../../db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResultGroup<T> {
  items: T[];
  total: number;
}

interface ProjectSearchItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface DocumentSearchItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectId: string;
  createdAt: Date;
}

interface WorkflowSearchItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface SearchResults {
  projects: SearchResultGroup<ProjectSearchItem>;
  documents: SearchResultGroup<DocumentSearchItem>;
  workflows: SearchResultGroup<WorkflowSearchItem>;
}

// ─── Global Search ───────────────────────────────────────────────────────────

export async function globalSearch(
  userId: string,
  query: string,
  limit = 3,
): Promise<SearchResults> {
  const term = `%${query}%`;

  // 1. Search projects where user is a member
  const memberProjectIds = db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  const projectWhere = and(
    inArray(projects.id, memberProjectIds),
    eq(projects.isDeleted, false),
    or(ilike(projects.name, term), ilike(projects.description, term)),
  );

  const [projectItems, [{ total: projectTotal }]] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(projectWhere)
      .limit(limit),
    db.select({ total: count() }).from(projects).where(projectWhere),
  ]);

  // 2. Search documents with visibility filtering
  const visibleSpecificIds = db
    .select({ documentId: documentVisibilityMembers.documentId })
    .from(documentVisibilityMembers)
    .where(eq(documentVisibilityMembers.userId, userId));

  const documentWhere = and(
    inArray(documents.projectId, memberProjectIds),
    eq(documents.isDeleted, false),
    or(ilike(documents.title, term), ilike(documents.description, term)),
    // Visibility: project-visible OR own OR specific-member
    or(
      eq(documents.visibility, "project"),
      eq(documents.createdBy, userId),
      and(
        eq(documents.visibility, "specific"),
        inArray(documents.id, visibleSpecificIds),
      ),
    ),
  );

  const [documentItems, [{ total: documentTotal }]] = await Promise.all([
    db
      .select({
        id: documents.id,
        title: documents.title,
        description: documents.description,
        status: documents.status,
        projectId: documents.projectId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(documentWhere)
      .limit(limit),
    db.select({ total: count() }).from(documents).where(documentWhere),
  ]);

  // 3. Search workflows (all authenticated users can see active workflows)
  const workflowWhere = and(
    eq(workflows.status, "active"),
    ilike(workflows.name, term),
  );

  const [workflowItems, [{ total: workflowTotal }]] = await Promise.all([
    db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        createdAt: workflows.createdAt,
      })
      .from(workflows)
      .where(workflowWhere)
      .limit(limit),
    db.select({ total: count() }).from(workflows).where(workflowWhere),
  ]);

  return {
    projects: { items: projectItems, total: projectTotal },
    documents: { items: documentItems, total: documentTotal },
    workflows: { items: workflowItems, total: workflowTotal },
  };
}
