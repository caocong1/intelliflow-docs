# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Common Commands

### Development
```bash
bun install                  # Install all dependencies
bun run dev                  # Start both frontend + backend concurrently
bun run dev:backend          # Start backend only (port 14001)
bun run dev:frontend         # Start frontend only (port 4000)
```

### Linting & Formatting
```bash
bun run check                # Biome check (lint + format) entire repo
bun run check:fix            # Biome check with auto-fix
bun run format               # Biome format only (write)
```

### Testing
```bash
bun x vitest                 # Run all tests (both packages)
bun x vitest --project backend       # Run backend tests only
bun x vitest --project frontend      # Run frontend tests only
bun x vitest packages/backend/src/modules/runtime/model-call.test.ts   # Run single test file
bun x vitest -t "test name pattern"  # Run tests matching pattern
```

### Database
```bash
bun run --filter @intelliflow/backend db:push    # Push schema changes to PostgreSQL (drizzle-kit)
bun run --filter @intelliflow/backend db:seed    # Seed database
```

### Build
```bash
bun run --filter @intelliflow/frontend build     # Build frontend for production
```

## Architecture

### Monorepo Structure

Three packages managed by Bun workspaces:
- **`@intelliflow/backend`** — Elysia HTTP server on port 14001, prefix `/api`
- **`@intelliflow/frontend`** — SolidJS app on port 4000, Vite proxies `/api` → backend
- **`@intelliflow/shared`** — Pure TypeScript type definitions (no runtime code)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun (not Node) |
| Backend | Elysia (TypeScript HTTP framework) |
| Frontend | SolidJS (NOT React — fine-grained reactive signals, no virtual DOM) |
| Database | PostgreSQL + Drizzle ORM |
| API Client | `@elysiajs/eden` — end-to-end type safety, frontend imports backend `App` type directly |
| CSS | TailwindCSS v4 |
| Code Quality | Biome (replaces ESLint + Prettier) |
| Testing | Vitest (node env for backend, jsdom for frontend) |

**Critical**: Frontend is SolidJS, not React. Do not use React patterns (useState, useEffect, JSX automatic runtime). Use SolidJS primitives (createSignal, createEffect, onMount, etc.) and the `vite-plugin-solid` JSX transform.

### Ports & Proxy
- **4000** — Frontend (Vite dev server)
- **14001** — Backend (Elysia)
- Vite config proxies `/api` → `http://127.0.0.1:14001`, including SSE streams

### Backend Architecture

Entry: `packages/backend/src/index.ts` — registers 25+ route modules under `/api`.

**Core modules** (`src/modules/`):
- `auth/`, `users/`, `wecom/` — Authentication (Bearer Token + localStorage) and WeCom OAuth
- `projects/`, `documents/`, `document-types/`, `workflows/`, `versions/` — Domain CRUD
- `providers/`, `models/` — AI provider and model management
- `files/` — File upload/download (binary stored on filesystem, metadata in DB)
- `notifications/`, `statistics/`, `search/`, `user-activity/` — Supporting services
- `ppt-templates/` — PPT template management (code_theme / native_pptx types)

**Runtime engine** (`src/modules/runtime/`) — the heart of the system:

The runtime drives execution of the 5 node types through a state machine (`runtime.service.ts`). It supports interactive mode (user steps through nodes) and background mode (`background.service.ts` auto-pipes nodes after input_transform completes). Node execution state is tracked in the `node_executions` DB table with `isCurrent` flag and `executionRound` to support rollback and re-execution.

**5 Node Types** (data flows through them in sequence):

1. **input_transform** (`input-transform.service.ts`) — User fills form + uploads files. Parses PDF/DOCX/TXT. Outputs `fields`, `fieldsByKey`, `files`, `fileSlots`, `text`.

2. **desensitize** (`desensitize.service.ts`) — Detects sensitive info via local model API or regex (phone/email/ID/bank card). Replaces with `[TYPE_N]` placeholders. Stores placeholder→original mappings in `desensitize_mappings` DB table. Rules (type descriptions only, no real values) auto-inject into subsequent model_call prompts.

3. **model_call** (`model-call.service.ts`) — Resolves `{{nodeId.segmentKey}}` variable references with 7-level lookup priority (fieldsByKey→fields→fileSlots→namedOutputs→models→sources→direct). Multi-model parallel calls with SSE streaming. Supports named outputs (`===OUTPUT:id===...===END:id===`), JSON Schema validation (ajv). User selects best model output. **Strategy pattern**: `OpenAICompatibleStrategy` (OpenAI/Ollama streaming) and `ClaudeAgentSDKStrategy` (simple_chat + autonomous_agent with tool use).

4. **restore** (`restore.service.ts`) — Replaces placeholders back with original values from `desensitize_mappings`. Can pair with specific desensitize node or use all document mappings.

5. **export** (`export.service.ts`) — Generates files: Word (docx lib), PDF (pdfkit), Markdown (raw), PPTX (dual path: JSON slide schema + ajv validation, or Markdown→slides). Supports template rendering (code_theme color merging, native_pptx placeholder replacement via pptx-automizer).

**Background pipeline**: After input_transform confirmation, `background.service.ts` auto-executes subsequent non-interactive nodes. Interactive nodes (model_call selection, non-auto desensitize, export) pause for user action. Monitors for stuck tasks (5-min scan, 15-min timeout). Detects orphan tasks on server restart.

### Database Schema (`src/db/schema.ts`)

Key tables: `users`, `sessions`, `workflows` (nodes/edges as JSONB), `documents`, `node_executions` (runtime state with `isCurrent`/`executionRound`), `desensitize_mappings` (placeholder→original, security-critical), `model_call_logs` (token usage, latency), `background_tasks`, `ppt_templates`.

Workflow nodes and edges are stored as JSONB — not normalized. The runtime engine does topological sort on the node graph at initialization.

### Frontend Architecture

Entry: `src/index.tsx` → `App.tsx` (25+ routes with admin guards).

**Key pages**:
- `workspace/DocumentWorkspace.tsx` (~65KB) — Core document execution workspace
- `admin/WorkflowEditor.tsx` — Visual workflow editor
- `admin/ModelConfiguration.tsx` — AI model/provider config
- `projects/ProjectHome.tsx` — Project hub

**Node executors** (`src/components/workspace/nodes/`) — Each of the 5 node types has a dedicated executor component handling its interactive UI (forms, desensitization review, model selection, restore editing, export download).

**Workflow canvas** (`src/components/workflow/`) — FlowCanvas with node library, validation overlay, alignment guides. Engine in `src/lib/flow-engine/` handles coordinates, alignment, validation, undo/redo, auto-save.

**API client** (`src/api/client.ts`) — Eden type-safe client importing backend `App` type for full type inference.

### Shared Types (`packages/shared/src/types.ts`)

Defines all node config types (`InputTransformConfig`, `DesensitizeConfig`, `ModelCallConfig`, `RestoreConfig`, `ExportConfig`), workflow types, and runtime types shared across frontend and backend.

### Package Manager Rules
- Use **Bun** exclusively (`bun install`, `bun run`, `bun add`). No pnpm/npm/yarn.
- Monorepo via Bun workspaces (`workspaces` in root package.json). No pnpm-workspace.yaml.
- **Biome** for linting and formatting. No ESLint/Prettier.
- **Bearer Token + localStorage** for auth. No JWT or Cookie Session.
