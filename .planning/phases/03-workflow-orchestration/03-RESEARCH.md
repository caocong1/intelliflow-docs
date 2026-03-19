# Phase 3: Workflow Orchestration - Research

**Researched:** 2026-03-19
**Domain:** Visual workflow editor, node-based UI, workflow data modeling
**Confidence:** MEDIUM

## Summary

Phase 3 requires building a drag-and-drop visual workflow editor where administrators design document generation pipelines using 5 node types. The core technical challenge is finding a node-based canvas library compatible with SolidJS (not React). The project uses SolidJS + Tailwind CSS v4 + Elysia + Drizzle ORM.

The best option is `@dschz/solid-flow` -- a SolidJS port of React Flow / Svelte Flow (xyflow). It is alpha (v0.1.4, published August 2025) but provides the full feature set needed: custom nodes, edges, handles, minimap, controls, background grid, drag-and-drop, zoom/pan. The API mirrors React Flow closely, which has extensive documentation and community patterns. The alternative -- building a custom canvas editor from scratch -- would consume enormous effort and is firmly in "don't hand-roll" territory.

**Primary recommendation:** Use `@dschz/solid-flow` for the node canvas editor. Store workflow definitions as JSONB in PostgreSQL via Drizzle ORM. Implement the right-side configuration panel as a standard SolidJS component alongside the canvas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Drag-and-drop canvas editor (n8n / ComfyUI style node canvas)
- Node addition: left-side node library panel (collapsible) drag onto canvas + right-click/button menu
- Node connections: auto-connect on add to previous node, support manual disconnect and reconnect via drag
- Node card compact mode: type icon + name + config status badge (configured/unconfigured), click to expand right-side config panel
- Click node opens right-side slide-out config panel (canvas and config visible simultaneously, no flow view obstruction)
- Node outputs are "content blocks" (md text), not emphasized as "files" in UI; user just "adds output" and names it
- Prompt editor shows upstream output references as inline color-coded tags (different colors per source node)
- Insert references via `{{` trigger or insert button, grouped dropdown by source node
- System variables (desensitization rules, output dir, etc.) shown as tags with different color from node output tags
- Save-time validation only (no editing-time interference)
- Validation errors shown as list (above/below canvas) with corresponding node border highlighted red
- Click error list item navigates to corresponding node
- Allow draft save: validation-failed workflows save as draft, cannot be enabled
- Workflow management list: table layout matching existing admin pages (UserManagement, DocumentTypeManagement)
- Filters: document type dropdown + keyword search (by workflow name)
- Default workflow badge in table row, "Set as Default" in action menu
- Workflow copy supports cross-document-type: choose target document type when copying

### Claude's Discretion
- Drag canvas specific technology choice (React Flow or other library)
- Node card visual design (colors, shadows, dimensions)
- Config panel width and animation effects
- Workflow preview (node flow diagram and file flow) display format
- Node type config form field layouts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Admin can create workflow (select document type, name, description) | Workflow management page (table + modal), `workflows` DB table with FK to `documentTypes` |
| FLOW-02 | Admin can add/arrange/configure nodes from 5 types in visual editor | `@dschz/solid-flow` canvas with custom node components, drag from node library panel |
| FLOW-03 | Same node type usable multiple times, each independently configured | Node instances stored as JSONB array, each with unique ID and own config object |
| FLOW-04 | Configure input transform node (form fields, file upload, output files) | Right-side config panel with form builder UI, stored in node config JSONB |
| FLOW-05 | Configure desensitize node (rules, placeholder format, local model) | Config panel with rule type selector, placeholder format input, model dropdown (local models only) |
| FLOW-06 | Configure model call node (display name, prompt template, model selection, I/O) | Prompt editor with tag-based variable insertion (`{{` trigger), model selector from `models` table |
| FLOW-07 | Configure restore node | Minimal config -- auto-paired with desensitize node, config panel shows pairing status |
| FLOW-08 | Configure export node (format, template, content mapping) | Config panel with format selector, template options, content mapping from upstream outputs |
| FLOW-09 | Prompt template supports `{{variable}}` interpolation | Custom prompt editor component with tag rendering, variable picker dropdown |
| FLOW-10 | System validates workflow on save (start/end rules, desensitize-restore pairing, required fields) | Backend validation logic + frontend validation display (error list + node highlighting) |
| FLOW-11 | Admin can enable/disable, edit, delete, copy workflows | Table actions + copy modal with document type selector for cross-type copy |
| FLOW-12 | Admin can set default workflow per document type | `isDefault` column + API endpoint with uniqueness constraint per document type |
| FLOW-13 | Visual preview of node flow and file data paths | Canvas read-only mode with data flow annotations on edges |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dschz/solid-flow | 0.1.4 | Node-based canvas editor | Only SolidJS port of xyflow (React Flow); provides nodes, edges, handles, minimap, controls, background |
| solid-js | ^1.9.5 | UI framework | Project standard (already installed) |
| drizzle-orm | ^0.39.3 | Database ORM | Project standard (already installed) |
| elysia | ^1.2.25+ | Backend framework | Project standard (already installed) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/solid | latest | Drag from node library panel to canvas | Dragging nodes from the left sidebar onto the canvas (solid-flow handles intra-canvas dragging) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dschz/solid-flow | Custom canvas from scratch | Months of work vs. days; don't hand-roll |
| @dschz/solid-flow | Rete.js + Lit plugin | Rete.js has no SolidJS plugin; Lit plugin adds indirection; less xyflow-like API |
| @dschz/solid-flow | miguelsalesvieira/solid-flow | Older (v1.0.4, Oct 2022), fewer features, no minimap/controls/background |

**Installation:**
```bash
bun add @dschz/solid-flow
```

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
├── pages/admin/
│   ├── WorkflowManagement.tsx        # List page (table + CRUD)
│   └── WorkflowEditor.tsx            # Canvas editor page
├── components/workflow/
│   ├── canvas/
│   │   ├── WorkflowCanvas.tsx        # SolidFlow wrapper with providers
│   │   ├── NodeLibraryPanel.tsx       # Left sidebar with draggable node types
│   │   ├── nodes/                    # Custom node components
│   │   │   ├── InputTransformNode.tsx
│   │   │   ├── DesensitizeNode.tsx
│   │   │   ├── ModelCallNode.tsx
│   │   │   ├── RestoreNode.tsx
│   │   │   └── ExportNode.tsx
│   │   ├── edges/
│   │   │   └── DataFlowEdge.tsx      # Custom edge showing data flow
│   │   └── ValidationOverlay.tsx     # Error list + node highlighting
│   ├── config/
│   │   ├── ConfigPanel.tsx           # Right-side slide-out panel container
│   │   ├── InputTransformConfig.tsx
│   │   ├── DesensitizeConfig.tsx
│   │   ├── ModelCallConfig.tsx
│   │   ├── RestoreConfig.tsx
│   │   └── ExportConfig.tsx
│   └── prompt/
│       ├── PromptEditor.tsx          # Rich text editor with tag insertion
│       └── VariablePicker.tsx        # Dropdown for {{variable}} insertion
packages/backend/src/
├── modules/workflows/
│   ├── routes.ts                     # CRUD + validate + copy + set-default endpoints
│   ├── service.ts                    # Business logic + validation engine
│   └── validation.ts                 # Workflow validation rules
├── db/schema.ts                      # Add workflows + workflowNodes tables
```

### Pattern 1: Workflow Data as JSONB
**What:** Store the entire workflow graph definition (nodes array + edges array) as JSONB columns in the `workflows` table, rather than separate node/edge rows.
**When to use:** When the graph is always loaded/saved as a whole unit (never queried node-by-node).
**Example:**
```typescript
// In schema.ts
import { jsonb, pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const workflowStatusEnum = pgEnum("workflow_status", ["draft", "active", "disabled"]);

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentTypeId: uuid("document_type_id")
    .notNull()
    .references(() => documentTypes.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: varchar("description", { length: 1000 }),
  status: workflowStatusEnum("status").default("draft").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  // Store entire graph as JSONB
  nodes: jsonb("nodes").$type<WorkflowNodeDef[]>().default([]).notNull(),
  edges: jsonb("edges").$type<WorkflowEdgeDef[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 2: Shared Type Definitions for Workflow Graph
**What:** Define node/edge types in `packages/shared/src/types.ts` so frontend and backend share the same workflow graph shape.
**Example:**
```typescript
// In packages/shared/src/types.ts

/** The 5 node types */
export type WorkflowNodeType =
  | "input_transform"
  | "desensitize"
  | "model_call"
  | "restore"
  | "export";

/** A node instance in a workflow */
export interface WorkflowNodeDef {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;  // Union type per node type
  outputs: OutputDef[];  // Named content block outputs
}

/** An edge connecting two nodes */
export interface WorkflowEdgeDef {
  id: string;
  source: string;       // source node ID
  target: string;       // target node ID
  sourceHandle?: string; // output handle ID
  targetHandle?: string; // input handle ID
}

/** Named output (content block) from a node */
export interface OutputDef {
  id: string;
  name: string;         // User-defined name for this output
  description?: string;
}
```

### Pattern 3: Node Config as Discriminated Union
**What:** Each node type has a specific config shape, discriminated by `type` field.
**Example:**
```typescript
export type NodeConfig =
  | InputTransformConfig
  | DesensitizeConfig
  | ModelCallConfig
  | RestoreConfig
  | ExportConfig;

export interface InputTransformConfig {
  type: "input_transform";
  formFields: FormFieldDef[];
  allowFileUpload: boolean;
  acceptedFileTypes?: string[];
}

export interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  modelId: string | null;        // References models table
  promptTemplate: string;        // Contains {{variableName}} references
  inputRefs: VariableRef[];      // Upstream outputs referenced in prompt
}

export interface VariableRef {
  nodeId: string;
  outputId: string;
  variableName: string;          // The name used in {{...}}
}
```

### Pattern 4: SolidFlow Custom Node Component
**What:** Each of the 5 node types renders as a custom SolidFlow node.
**Example:**
```typescript
// Based on @dschz/solid-flow API (mirrors React Flow)
import { Handle, Position } from "@dschz/solid-flow";

function ModelCallNode(props: { data: WorkflowNodeDef }) {
  return (
    <div class="rounded-lg border-2 border-gray-200 bg-white p-3 shadow-sm min-w-[180px]">
      <div class="flex items-center gap-2">
        <span class="text-lg"><!-- model icon SVG --></span>
        <span class="font-medium text-sm">{props.data.label}</span>
        <span class={`ml-auto text-xs px-1.5 py-0.5 rounded ${
          props.data.config.modelId ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}>
          {props.data.config.modelId ? "Configured" : "Unconfigured"}
        </span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### Pattern 5: Validation Engine (Backend)
**What:** Server-side validation on save, returning structured error list.
**Example:**
```typescript
interface ValidationError {
  nodeId?: string;      // null for graph-level errors
  field?: string;
  message: string;
  severity: "error" | "warning";
}

function validateWorkflow(nodes: WorkflowNodeDef[], edges: WorkflowEdgeDef[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule: Must have at least one input_transform at the start
  // Rule: Must have at least one export at the end
  // Rule: Every desensitize node must have a matching restore node downstream
  // Rule: Required fields per node type must be filled
  // Rule: No orphan nodes (every node must be connected)
  // Rule: No cycles in the graph (DAG validation)
  // Rule: Referenced model IDs must exist and be active

  return errors;
}
```

### Anti-Patterns to Avoid
- **Separate tables for each node instance:** Overkill for workflow definitions that are always loaded/saved atomically. JSONB is simpler and faster.
- **Frontend-only validation:** Always validate on the backend too. Frontend validation is for UX; backend validation is for data integrity.
- **Storing React Flow internal state in DB:** Only store the semantic data (node type, config, position, edges). Don't persist internal library state like selection, viewport, or animation state.
- **Deeply nested config objects:** Keep node configs flat where possible. Deeply nested JSONB is hard to query and migrate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node canvas with zoom/pan/drag | Custom SVG/Canvas implementation | @dschz/solid-flow | Hundreds of edge cases: hit testing, viewport transforms, touch support, accessibility, keyboard nav |
| Node connections/edges | Custom line drawing | @dschz/solid-flow edges + handles | Bezier curves, edge routing, connection validation, drag-to-connect UX |
| Drag from sidebar to canvas | Custom HTML5 DnD | @dnd-kit/solid or native DnD with solid-flow onDrop | Cross-browser compatibility, touch support, drag preview |
| Graph cycle detection | Custom BFS/DFS | Simple topological sort utility | Well-known algorithm, easy to get wrong with edge cases |
| JSONB type safety | Runtime type checking | Drizzle `.$type<T>()` + Zod validation | Compile-time safety + runtime validation |

**Key insight:** A visual node editor is a deceptively complex UI component. Even basic features (zoom, pan, drag, connect, select, keyboard shortcuts) involve hundreds of interaction edge cases. Using solid-flow saves weeks of development.

## Common Pitfalls

### Pitfall 1: Alpha Library Instability
**What goes wrong:** `@dschz/solid-flow` is v0.1.4 (alpha). API may change or have bugs.
**Why it happens:** Small community library, not yet battle-tested.
**How to avoid:** Pin the exact version in package.json. Write a thin wrapper layer around solid-flow so the rest of the app doesn't directly depend on its API. If a bug is found, you can patch the wrapper without changing all consumers.
**Warning signs:** Build failures after bun update, type errors on upgrade.

### Pitfall 2: JSONB Schema Migration
**What goes wrong:** Changing node config structure after data exists in production breaks existing workflows.
**Why it happens:** JSONB has no schema enforcement at the DB level.
**How to avoid:** Include a `version` field in the workflow JSONB. Write migration functions that upgrade old versions on read. Validate with Zod on both read and write.
**Warning signs:** `undefined` errors when loading old workflows after a config shape change.

### Pitfall 3: Desensitize-Restore Pairing Validation
**What goes wrong:** Users create workflows where desensitize nodes have no matching restore downstream, or restore nodes reference non-existent desensitize data.
**Why it happens:** Graph validation is non-trivial when nodes can be freely arranged.
**How to avoid:** Validation rule: for every desensitize node, there must be at least one restore node reachable downstream via edges. Track the pairing explicitly in the restore node config.
**Warning signs:** Runtime errors during workflow execution (Phase 5).

### Pitfall 4: Variable Reference Integrity
**What goes wrong:** User deletes a node or output, but other nodes still reference it in prompt templates via `{{variableName}}`.
**Why it happens:** No automatic cleanup of references when nodes/outputs are removed.
**How to avoid:** On node/output deletion, scan all downstream nodes for references and either auto-remove with warning, or block deletion until references are cleared. Include dangling reference check in save-time validation.
**Warning signs:** `{{undefined}}` appearing in prompt templates.

### Pitfall 5: Default Workflow Race Condition
**What goes wrong:** Two admins simultaneously set different workflows as default for the same document type.
**Why it happens:** Read-then-write without transaction.
**How to avoid:** Use a database transaction: unset all `isDefault` for the document type, then set the new default, in a single transaction.
**Warning signs:** Multiple workflows marked as default for one document type.

## Code Examples

### Workflow CRUD API Routes
```typescript
// packages/backend/src/modules/workflows/routes.ts
import Elysia, { t } from "elysia";

const workflowRoutes = new Elysia({ prefix: "/workflows" })
  .get("/", async ({ query }) => {
    // List workflows with optional documentTypeId filter and search
  }, {
    query: t.Object({
      documentTypeId: t.Optional(t.String()),
      search: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
    })
  })
  .post("/", async ({ body }) => {
    // Create workflow (starts as draft)
  })
  .put("/:id", async ({ params, body }) => {
    // Update workflow (nodes, edges, config)
  })
  .post("/:id/validate", async ({ params }) => {
    // Validate workflow, return errors array
  })
  .post("/:id/copy", async ({ params, body }) => {
    // Copy workflow, optionally to different document type
  }, {
    body: t.Object({
      targetDocumentTypeId: t.Optional(t.String()),
      name: t.String(),
    })
  })
  .patch("/:id/status", async ({ params, body }) => {
    // Enable/disable workflow (only if validation passes for enable)
  })
  .patch("/:id/set-default", async ({ params }) => {
    // Set as default for its document type (transaction: unset others, set this)
  })
  .delete("/:id", async ({ params }) => {
    // Delete workflow
  });
```

### Prompt Editor with Tag Insertion
```typescript
// Concept for the prompt editor with {{ trigger
// Uses a contenteditable div or textarea with overlay for tags

function PromptEditor(props: {
  value: string;
  availableVariables: VariableRef[];
  onChange: (value: string) => void;
}) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [pickerPosition, setPickerPosition] = createSignal({ x: 0, y: 0 });

  // Detect {{ typing to trigger variable picker
  function handleInput(e: InputEvent) {
    const text = (e.target as HTMLTextAreaElement).value;
    const cursorPos = (e.target as HTMLTextAreaElement).selectionStart;
    const before = text.slice(0, cursorPos);

    if (before.endsWith("{{")) {
      setShowPicker(true);
      // Position picker near cursor
    } else {
      setShowPicker(false);
    }
    props.onChange(text);
  }

  function insertVariable(ref: VariableRef) {
    // Replace the trailing {{ with {{variableName}}
    setShowPicker(false);
  }

  return (
    <div class="relative">
      <textarea onInput={handleInput} value={props.value} />
      <Show when={showPicker()}>
        <VariablePicker
          variables={props.availableVariables}
          onSelect={insertVariable}
        />
      </Show>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Flow only | xyflow family (React + Svelte + community SolidJS port) | 2023-2024 | SolidJS projects can use node editors |
| Separate node/edge DB tables | JSONB graph storage | Ongoing trend | Simpler schema for workflow definitions loaded atomically |
| Custom canvas rendering | Library-based node UIs | 2020+ | Weeks of saved development time |

**Deprecated/outdated:**
- `miguelsalesvieira/solid-flow` (v1.0.4, Oct 2022): Older, fewer features, superseded by `@dschz/solid-flow`
- `@matthewgapp/solidjs-flow`: Community port, PR to xyflow was closed without merge

## Open Questions

1. **@dschz/solid-flow stability in production**
   - What we know: Alpha v0.1.4, 36 stars, mirrors React Flow API, missing 3 minor features
   - What's unclear: How stable it is under complex workflows with 20+ nodes
   - Recommendation: Pin version, build thin wrapper, test with realistic workflow sizes early

2. **Prompt editor implementation approach**
   - What we know: Need `{{` trigger, inline colored tags, variable picker dropdown
   - What's unclear: Whether to use contenteditable, textarea with overlay, or a rich text library
   - Recommendation: Start with textarea + overlay pattern (simpler); upgrade to contenteditable only if needed for inline tag rendering

3. **Workflow versioning for future migration**
   - What we know: JSONB schema will evolve as features are added in later phases
   - What's unclear: Exact migration strategy when Phase 5 (execution) needs to read Phase 3 workflow definitions
   - Recommendation: Add `schemaVersion: number` field to workflow JSONB from day one

## Sources

### Primary (HIGH confidence)
- [xyflow/xyflow GitHub](https://github.com/xyflow/xyflow) - React Flow / Svelte Flow project structure and API patterns
- [npm registry @dschz/solid-flow](https://registry.npmjs.org/@dschz/solid-flow) - Version 0.1.4, published Aug 2025
- [Drizzle ORM JSONB docs](https://orm.drizzle.team/docs/custom-types) - JSONB column type with `$type<T>()`
- Existing project codebase: schema.ts, types.ts, package.json files

### Secondary (MEDIUM confidence)
- [dsnchz/solid-flow GitHub](https://github.com/dsnchz/solid-flow) - Alpha status, API docs, feature list, 36 stars
- [solid-dnd](https://solid-dnd.com/) and [@dnd-kit/solid](https://dndkit.com/solid/quickstart) - SolidJS drag-and-drop options
- [Rete.js](https://retejs.org/) - Alternative framework (no SolidJS plugin, ruled out)

### Tertiary (LOW confidence)
- Community discussions on xyflow SolidJS support - indicates interest but no official port planned

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - @dschz/solid-flow is alpha but only viable SolidJS option; JSONB pattern is well-established
- Architecture: HIGH - JSONB workflow storage, shared types, custom nodes are proven patterns from React Flow ecosystem
- Pitfalls: HIGH - These are well-documented issues in workflow editor projects

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (check @dschz/solid-flow for new releases)
