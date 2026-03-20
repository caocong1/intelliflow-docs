# Phase 4: Project + Document + Version + File System Infrastructure - Research

**Researched:** 2026-03-20
**Domain:** Multi-tenant project management, document lifecycle, version control, file system abstraction
**Confidence:** HIGH

## Summary

Phase 4 introduces the core project/document/version data model and file system infrastructure that all subsequent phases (document creation, node execution) depend on. The implementation spans four sub-domains: (1) project CRUD with role-based member management, (2) document management with visibility controls, (3) version snapshots with timeline and diff views, and (4) a simplified file system for uploads/exports with DB-stored intermediate content.

The existing codebase provides strong patterns to follow: Drizzle ORM pgTable schema definitions, modular backend services (routes.ts + service.ts per module), Eden Treaty type-safe API client, SolidJS + Tailwind CSS frontend with reusable UI components (Table, Modal, Badge, Pagination, SearchInput, Toast). The sidebar navigation needs a new "Projects" section for regular users. The storage architecture decision (CONTEXT.md) significantly simplifies file system work -- intermediate node text goes to DB, only uploads and exports use the filesystem.

**Primary recommendation:** Follow existing module patterns strictly. Define schema tables first (projects, project_members, documents, document_versions, document_files), build backend services with proper authorization guards (requireAuth for project routes, owner checks for admin operations), then build frontend pages reusing existing UI components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Project list uses table layout, reusing existing Table component, consistent with admin page style
- Top Tab switching between three views: My Created | My Joined | All Projects
- Project list columns: name, description, role, member count, creation time
- Project home first screen is document list (with filter + search), top shows project info summary
- Project owner sees extra "Settings" entry (gear icon)
- Separate settings page (gear icon in project top-right), owner-only access
- Settings includes: basic info edit + member management + recycle bin (deleted docs restore/permanent delete)
- Document visibility default: "project members visible", set during creation implicitly
- Visibility modified in document settings: self-only | project members | specific members
- "Specific members" uses Modal multi-select list (reuse existing Modal), shows project members with checkboxes
- Document list shows visibility status via colored Badge (reuse existing Badge)
- Recycle bin in project settings page, owner-only access
- Version history uses vertical Timeline component (new), each node shows: node name, completion time, operator
- Version Diff uses side-by-side comparison (like GitHub), difference lines highlighted
- Version snapshots auto-generated on node completion (confirm/next step) only, no manual save
- Version history entry is a separate page (button from document detail or list)
- **Storage architecture (major adjustment):** intermediate node text content all stored in DB (text field) -- desensitize, model call, restore nodes' I/O are text
- **Only uploads and exports use file system** -- minimize filesystem dependency
- File system directory structure simplified to: `uploads/{doc-uuid}/` and `exports/{doc-uuid}/`
- No step subdirectories needed (step-01-input/ etc.), intermediate node data goes to DB
- Workspace root path via environment variable (e.g., WORKSPACE_ROOT=/data/workspaces)
- UUID-named directories to avoid Chinese path issues
- Document deletion: directory not moved, only marked archived in DB; periodic cleanup task handles expired archives
- Desensitization mapping: encrypted in DB + local copy in filesystem (.mappings/ directory)

### Claude's Discretion
- Specific DB table structure design (projects, project_members, documents, versions, etc.)
- API route design and permission middleware implementation
- Version snapshot storage format (JSONB or separate table)
- Timeline and Diff component implementation details
- Sidebar navigation adjustments (regular user project entry)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-01 | User can create project (name, description, department) | New `projects` table + POST /projects route + create project form (Modal) |
| PROJ-02 | User can edit project info | PATCH /projects/:id route + edit form |
| PROJ-03 | Project owner can delete project (soft delete) | `deletedAt` column + soft delete pattern |
| PROJ-04 | User can view project list (created/joined/all) with search/filter | Tab-based list page + query filters on backend |
| PROJ-05 | Project owner can invite/remove members | `project_members` join table + POST/DELETE member routes |
| PROJ-06 | Project member can leave project (owner must transfer first) | DELETE /projects/:id/members/me + ownership check |
| PROJ-07 | Two roles: owner (full permissions) and participant (limited) | `projectRoleEnum` pgEnum + role checks in guards |
| PROJ-08 | Project creator is default owner, can add multiple owners | Creator auto-inserted as owner in project_members |
| PROJ-09 | Project home shows role-appropriate view (doc list, tasks, member mgmt) | Conditional UI based on member role |
| DMGT-01 | View document list in project (filter by time/type/status) | GET /projects/:id/documents with query params |
| DMGT-02 | Search documents (by title, description keywords) | `ilike` search on title/description columns |
| DMGT-03 | View document detail (basic info, execution history, workspace browse) | GET /documents/:id with relations |
| DMGT-04 | Delete document (soft delete, enters recycle bin) | `deletedAt` column + soft delete |
| DMGT-05 | Document creator can set visibility (self/project/specific members) | `visibilityEnum` + `document_visibility_members` join table |
| DMGT-06 | Project owner can view all documents regardless of visibility | Owner bypass in document query logic |
| VER-01 | Auto version snapshot on node completion | `document_versions` table + snapshot creation in node completion flow |
| VER-02 | View version list (timeline form) | New Timeline component + GET /documents/:id/versions |
| VER-03 | Compare two versions (Diff view) | Side-by-side diff component + GET versions/:a/diff/:b |
| FSYS-01 | Auto-create standardized workspace directory per document | mkdir `uploads/{doc-uuid}/` and `exports/{doc-uuid}/` on doc create |
| FSYS-02 | Node outputs written to step subdirectories with DB indexing | Per CONTEXT.md: text to DB, only files to filesystem; `document_files` table for indexing |
| FSYS-03 | Nodes reference data via file paths | Per CONTEXT.md: text content via DB references, binary files via filesystem paths |
| FSYS-04 | Workspace bound to document; archive on delete, no immediate physical delete | `isArchived` flag on document; periodic cleanup for expired archives |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.39.3 | Database schema, queries, migrations | Already in use; type-safe SQL builder |
| postgres (npm) | ^3.4.5 | PostgreSQL driver | Already in use; chosen over bun:sql for stability |
| Elysia | ^1.2.25 | HTTP framework, route definitions | Already in use; provides type-safe routes |
| @elysiajs/eden | (existing) | Type-safe API client | Already in use; treaty pattern established |
| SolidJS | (existing) | Frontend framework | Already in use; reactive UI |
| Tailwind CSS | v4 (existing) | Styling | Already in use |
| drizzle-kit | ^0.30.5 | Schema push/migrations | Already in use; `bun run db:push` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs/promises | built-in | File system operations (mkdir, rm, stat) | Creating upload/export directories |
| Node.js path | built-in | Path manipulation | Building workspace paths |
| Node.js crypto | built-in | Encryption for desensitization mappings | Encrypting mapping JSON before DB storage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fs/promises for directories | @aws-sdk/client-s3 | Overkill for v1; upgrade path exists per storage-architecture.md |
| Custom diff logic | diff library (npm) | Custom is fine for text diff; can adopt library if complexity grows |

**Installation:**
No new dependencies needed for Phase 4 core. All required libraries already in the workspace.

## Architecture Patterns

### Recommended Project Structure

**Backend new modules:**
```
packages/backend/src/modules/
├── projects/
│   ├── projects.routes.ts      # CRUD + member management routes
│   └── projects.service.ts     # Business logic
├── documents/
│   ├── documents.routes.ts     # CRUD + visibility + recycle bin
│   └── documents.service.ts    # Business logic
├── versions/
│   ├── versions.routes.ts      # Version list + diff
│   └── versions.service.ts     # Snapshot creation, diff logic
└── files/
    ├── files.routes.ts         # File upload/download endpoints (Phase 5 will extend)
    └── files.service.ts        # Workspace directory management
```

**Frontend new pages:**
```
packages/frontend/src/pages/
├── projects/
│   ├── ProjectList.tsx         # Tab-based project list (created/joined/all)
│   ├── ProjectHome.tsx         # Project home with document list
│   └── ProjectSettings.tsx     # Settings page (info + members + recycle bin)
├── documents/
│   ├── DocumentDetail.tsx      # Document info + version history entry
│   └── VersionHistory.tsx      # Timeline + diff view
```

**Frontend new components:**
```
packages/frontend/src/components/
├── ui/
│   └── Timeline.tsx            # Vertical timeline component (new)
├── documents/
│   ├── VisibilityBadge.tsx     # Colored badge for visibility status
│   ├── MemberSelectModal.tsx   # Multi-select member picker
│   └── VersionDiff.tsx         # Side-by-side diff display
```

### Pattern 1: DB Schema Design

**What:** Drizzle ORM pgTable definitions following existing patterns (uuid PK, timestamps, references).

**Schema tables to add:**

```typescript
// New enums
export const projectRoleEnum = pgEnum("project_role", ["owner", "participant"]);
export const documentVisibilityEnum = pgEnum("document_visibility", ["self", "project", "specific"]);
export const documentStatusEnum = pgEnum("document_status", ["draft", "in_progress", "completed"]);

// Projects table
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: varchar("description", { length: 1000 }),
  department: varchar("department", { length: 100 }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Project members join table
export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: projectRoleEnum("role").default("participant").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

// Documents table
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id),
  title: varchar("title", { length: 300 }).notNull(),
  description: varchar("description", { length: 1000 }),
  status: documentStatusEnum("status").default("draft").notNull(),
  visibility: documentVisibilityEnum("visibility").default("project").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Document visibility members (for "specific" visibility)
export const documentVisibilityMembers = pgTable("document_visibility_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  userId: uuid("user_id").notNull().references(() => users.id),
});

// Document versions (snapshots)
export const documentVersions = pgTable("document_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  versionNumber: integer("version_number").notNull(),
  nodeId: varchar("node_id", { length: 100 }).notNull(),  // workflow node that triggered this
  nodeLabel: varchar("node_label", { length: 200 }).notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),  // JSONB with node outputs at this point
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Document files (index for filesystem files)
export const documentFiles = pgTable("document_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  category: varchar("category", { length: 20 }).notNull(), // 'upload' | 'export'
  originalName: varchar("original_name", { length: 500 }).notNull(),
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 2: Authorization Guard for Project Routes

**What:** Project routes need a `requireAuth` guard (not `requireAdmin`), plus project-specific permission checks.

**When to use:** All project and document routes -- these are user-facing, not admin-only.

```typescript
// New guard: requireProjectOwner (middleware pattern)
// Checks that current user is an owner of the specified project
async function requireProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const member = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ))
    .limit(1);
  return member.length > 0 && member[0].role === "owner";
}

// Document visibility filter -- applied in list queries
function buildVisibilityFilter(userId: string, isProjectOwner: boolean) {
  if (isProjectOwner) return undefined; // owners see all (DMGT-06)
  // Non-owners: see documents where visibility='project' OR creator=self OR in specific members list
  return or(
    eq(documents.visibility, "project"),
    eq(documents.createdBy, userId),
    // subquery for specific member inclusion
  );
}
```

### Pattern 3: Workspace Directory Management

**What:** Simplified file system with only uploads/ and exports/ directories per document.

```typescript
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "./data/workspaces";

export async function createDocumentWorkspace(documentId: string): Promise<void> {
  const uploadsDir = join(WORKSPACE_ROOT, "uploads", documentId);
  const exportsDir = join(WORKSPACE_ROOT, "exports", documentId);
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(exportsDir, { recursive: true });
}

export async function archiveDocumentWorkspace(documentId: string): Promise<void> {
  // Per CONTEXT.md: don't move/delete, just mark in DB
  // Physical cleanup handled by periodic task
}
```

### Pattern 4: Version Diff Logic

**What:** Compare two version snapshots and produce diff output.

```typescript
// Simple line-by-line diff for text content
interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber?: number;
}

function computeTextDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  // LCS-based diff algorithm
  // Returns array of DiffLine for side-by-side rendering
}
```

### Anti-Patterns to Avoid
- **Nested resource routes too deep:** Don't do `/projects/:pid/documents/:did/versions/:vid/diff/:vid2`. Keep routes shallow: `/documents/:id/versions`, `/versions/:id/diff/:otherId`.
- **File system as source of truth:** Per storage architecture, DB is the single source of truth. Filesystem is only for binary uploads/exports.
- **Admin-only project routes:** Projects are user-facing. Use `requireAuth`, not `requireAdmin`. Owner checks are per-project, not per-system-role.
- **Eager loading full version snapshots in lists:** Version list should return metadata only; snapshot data loaded on demand for diff.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diffing | Custom character-level diff | Simple line-based diff or `diff` npm package | LCS algorithm is well-studied; line-based is sufficient for document text |
| File upload handling | Custom multipart parser | Elysia's built-in body parsing with `t.File()` | Elysia handles multipart natively |
| UUID generation | Custom ID generator | PostgreSQL `gen_random_uuid()` via Drizzle `defaultRandom()` | Already established pattern |
| Pagination | Custom offset logic | Existing pattern from users.service.ts (offset + count) | Proven pattern already in codebase |

**Key insight:** This phase is primarily CRUD + authorization logic. The established patterns in the codebase (Drizzle schema + Elysia routes + Eden client + SolidJS pages) cover 90% of the implementation. The novel parts are the Timeline component, Diff view, and workspace directory management.

## Common Pitfalls

### Pitfall 1: Visibility Filter Performance
**What goes wrong:** Document list queries with visibility checks become slow due to subqueries for "specific members" check.
**Why it happens:** Each document needs to check if user is in document_visibility_members when visibility="specific".
**How to avoid:** Use a LEFT JOIN with document_visibility_members and filter in WHERE clause. Consider a DB index on (document_id, user_id) for the visibility members table.
**Warning signs:** Document list page load time exceeding 500ms with 100+ documents.

### Pitfall 2: Race Condition on Member Role Transfer
**What goes wrong:** Owner tries to leave project while another request is adding them as the sole owner.
**Why it happens:** PROJ-06 requires owner to transfer role before leaving. Concurrent requests can create orphaned projects.
**How to avoid:** Use database transactions. Check owner count within the same transaction as the leave operation.
**Warning signs:** Projects with zero owners in the database.

### Pitfall 3: Soft Delete Cascading Confusion
**What goes wrong:** Soft-deleted projects still show documents; soft-deleted documents still appear in version history.
**Why it happens:** Queries don't consistently filter `isDeleted = false`.
**How to avoid:** Create helper functions like `activeProjects()` and `activeDocuments()` that always include the soft-delete filter. Apply consistently in all list/detail queries.
**Warning signs:** Deleted items appearing in UI lists.

### Pitfall 4: Workspace Root Not Configured
**What goes wrong:** File operations fail in production because WORKSPACE_ROOT env var is missing.
**Why it happens:** Development uses relative path fallback, production needs explicit configuration.
**How to avoid:** Validate WORKSPACE_ROOT at startup (similar to DATABASE_URL validation in db/index.ts). Log a warning if using fallback.
**Warning signs:** File upload/export failures in production.

### Pitfall 5: Version Snapshot Size Bloat
**What goes wrong:** JSONB snapshot data grows large when documents have many nodes with long text content.
**Why it happens:** Storing full text content in every snapshot duplicates data across versions.
**How to avoid:** Store only changed content per version, or store references to node_outputs table rows. Consider storing a delta rather than full snapshot.
**Warning signs:** document_versions table growing significantly faster than expected.

## Code Examples

### Backend Route Pattern (following existing conventions)
```typescript
// packages/backend/src/modules/projects/projects.routes.ts
import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { createProject, listProjects } from "./projects.service";

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(requireAuth)
  .get(
    "/",
    async ({ user, query }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;
      const tab = query.tab || "all"; // "created" | "joined" | "all"
      return listProjects(user!.id, tab, page, pageSize);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        tab: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      const project = await createProject(user!.id, body);
      set.status = 201;
      return project;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
        department: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  );
```

### Frontend Page Pattern (following existing conventions)
```typescript
// SolidJS page with Tab switching -- pattern for ProjectList.tsx
const [activeTab, setActiveTab] = createSignal<"created" | "joined" | "all">("all");
const [projects, setProjects] = createSignal<Project[]>([]);
const [total, setTotal] = createSignal(0);

async function fetchProjects() {
  const { data, error } = await api.api.projects.get({
    query: { tab: activeTab(), page: String(page()), search: search() },
  });
  if (data) {
    setProjects(data.data);
    setTotal(data.total);
  }
}

createEffect(() => {
  activeTab(); // track
  fetchProjects();
});
```

### Sidebar Navigation Extension
```typescript
// Add below Dashboard link, visible to all authenticated users
<div class="pt-5 pb-1.5 px-3">
  <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest">工作区</p>
</div>
<A href="/projects" class={linkClass("/projects")}>
  {/* folder icon */}
  项目
</A>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Step subdirectories (step-01-input/) | DB-stored text + simplified uploads/exports dirs | CONTEXT.md decision (2026-03-20) | Major simplification of FSYS requirements |
| Full file system working directory per node | Only binary files on filesystem | CONTEXT.md decision | Reduces FSYS-02/FSYS-03 complexity significantly |

**Key architectural note:** The CONTEXT.md storage decision fundamentally reshapes FSYS-01 through FSYS-04. The original requirements assumed a full file-per-node filesystem structure. The decision to store intermediate text in DB means:
- FSYS-01: Only creates `uploads/{doc-uuid}/` and `exports/{doc-uuid}/`
- FSYS-02: "Node outputs to step subdirectories" becomes "text to DB, only binary files to filesystem with DB index"
- FSYS-03: "File path references" becomes "DB content references for text, filesystem paths for binaries"
- FSYS-04: Archive = DB flag, not directory move

## Open Questions

1. **Version snapshot granularity**
   - What we know: Snapshots created per node completion (VER-01). CONTEXT.md says JSONB or separate table is Claude's discretion.
   - What's unclear: Should snapshot store full document state or delta from previous version? Full state is simpler but larger; delta is compact but requires reconstruction.
   - Recommendation: Use JSONB with full state for v1 simplicity. Snapshot data is node outputs at that point in time. Optimize later if size becomes an issue.

2. **Text diff algorithm for VER-03**
   - What we know: Side-by-side diff like GitHub. Content is document text (likely Markdown).
   - What's unclear: Line-level or word-level diff? How to handle large documents?
   - Recommendation: Start with line-level diff (simpler, matches GitHub pattern). Compute diff on backend, return structured diff data. Can enhance to word-level later.

3. **Sidebar navigation structure for regular users**
   - What we know: Need to add "Projects" entry for all users. Currently sidebar only has Dashboard (all users) and Admin section (admins only).
   - What's unclear: Exact placement and grouping.
   - Recommendation: Add a "Workspace" section between Dashboard and Admin, containing "Projects" link. Visible to all authenticated users.

4. **Document types table association check**
   - What we know: DTYPE-04 has a placeholder for association check (noted in STATE.md decisions [06-01]).
   - What's unclear: Now that documents table will exist, should we update the association check?
   - Recommendation: Yes, update DTYPE-04 association check in this phase since documents table references documentTypes. Add this as a small task.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `packages/backend/src/db/schema.ts`, `packages/backend/src/modules/*/`, `packages/frontend/src/` -- established patterns
- CONTEXT.md (04-CONTEXT.md) -- locked user decisions
- Storage architecture design: `docs/design/storage-architecture.md` -- DB + filesystem hybrid strategy
- STATE.md -- accumulated project decisions and conventions

### Secondary (MEDIUM confidence)
- Drizzle ORM patterns -- pgTable, pgEnum, references, JSONB typing -- verified against existing schema.ts usage
- Elysia route patterns -- verified against existing routes (users, providers, models, workflows)
- Eden Treaty client pattern -- verified against existing `packages/frontend/src/api/client.ts`

### Tertiary (LOW confidence)
- Text diff algorithm specifics -- based on general knowledge; may need npm `diff` package if line-based LCS is insufficient

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely using existing libraries, no new dependencies
- Architecture: HIGH -- follows established codebase patterns; schema design is straightforward CRUD
- Pitfalls: HIGH -- common patterns well-understood; visibility filter and soft-delete are standard challenges
- File system: HIGH -- CONTEXT.md decision simplifies this significantly
- Version diff: MEDIUM -- algorithm choice (line vs word level) needs validation during implementation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
