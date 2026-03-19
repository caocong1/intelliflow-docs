# Technology Stack

**Project:** IntelliFlow -- AI Document Generation Platform
**Researched:** 2026-03-19

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| NestJS | 11.x (current stable) | Backend framework | Opinionated enterprise architecture with DI, modularity, guards, interceptors. Supports Fastify adapter for performance. 3M+ weekly downloads. Series A funded, maintained until 2030+. v12 planned Q3 2026. | HIGH |
| React | 19.x | Frontend UI | Industry standard for complex interactive UIs. Required by React Flow (workflow editor). Massive ecosystem. | HIGH |
| Vite | 6.x | Frontend build tool | This is an internal tool (no SEO needed). Vite provides millisecond HMR, smaller bundles, simpler config vs Next.js. Next.js SSR/SSG adds unnecessary complexity for an internal enterprise SPA. | HIGH |
| TypeScript | 5.7+ | Language (full-stack) | Type safety across frontend/backend. Required by Prisma, NestJS, React Flow. Non-negotiable for a project this size. | HIGH |

### Database & Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16+ | Primary database | Already decided in storage-architecture.md. Stores metadata, text content, encrypted desensitization mappings, file indexes, execution records. pgcrypto for field-level encryption. RLS for row-level security. | HIGH |
| Redis | 7.x | Queue backend + caching | Required by BullMQ for task queues. Also serves as session store and cache layer. Lightweight, battle-tested. | HIGH |
| Server filesystem | -- | Binary file storage | Already decided. Stores uploaded files, exported documents, CLI temp workspaces. Upgradeable to MinIO/S3 later. | HIGH |

### ORM & Database Access

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Prisma | 7.x | ORM | Prisma 7 dropped Rust engine -- now pure TypeScript. 3x faster queries, 90% smaller bundles vs Prisma 6. Schema-first approach matches well with the complex relational model (projects, documents, workflows, nodes, versions). Excellent migration tooling. NestJS has first-class Prisma integration. | HIGH |

### Task Queue

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| BullMQ | 5.x | Async job processing | File parsing, CLI command execution, background AI generation, cleanup tasks. Redis-backed, supports priorities, retries with exponential backoff, cron scheduling, concurrency control. Already referenced in material-context-design.md. Bull Board for monitoring dashboard. | HIGH |

### Workflow Editor (Frontend)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @xyflow/react (React Flow) | 12.x | Visual workflow editor | Dominant library for node-based UIs in React. Used by Stripe, Typeform. MIT licensed. Active development (12.10.1 as of early 2026). Supports custom nodes, drag-and-drop, auto-layout via ELKjs. Perfect for the 5-node-type workflow orchestration UI. | HIGH |

### Rich Text / Markdown Editor

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TipTap | 2.x | Markdown editing + preview | ProseMirror-based, headless architecture (full UI control). Built-in Markdown import/export. Best React integration among editors in 2025. Supports collaborative editing (future). Smaller bundle than alternatives. Used for inline editing at each node step. | MEDIUM |

### Document Format Conversion

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| mammoth | 1.12.x | Word (.docx) parsing to text/HTML | Actively maintained (latest release days ago). Clean semantic conversion. Handles Word/Google Docs/LibreOffice docx. For input file parsing. | HIGH |
| pdf-parse | 2.4.x | PDF text extraction | Pure TypeScript, zero native deps. Cross-platform. Extracts text with page-level granularity. For input file parsing. | HIGH |
| exceljs | 4.4.x | Excel read/write | Read uploaded Excel files, generate Excel exports. Supports formulas, styles, streaming. Mature and widely used. | MEDIUM |
| docx (npm) | 9.x | Word (.docx) generation | Programmatic docx creation from scratch. Supports templates, styles, headers/footers. For the export node (Markdown to Word). | MEDIUM |
| md-to-pdf | 5.x | Markdown to PDF export | Uses Puppeteer (headless Chromium) for high-fidelity PDF rendering. Supports custom CSS styling. For the export node. | MEDIUM |
| remark + remark-docx | latest | Markdown to Word (alternative) | remark ecosystem plugin. If docx (npm) proves too low-level, remark-docx offers a higher-level Markdown-to-Word pipeline. | LOW |

### Real-time Communication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SSE (Server-Sent Events) | Native | Streaming AI responses | 2025 is "the year of SSE" -- standard for streaming LLM responses. Unidirectional (server to client), works over HTTP, no protocol upgrade. Already specified in the requirements (Appendix A: SSE event protocol). NestJS has built-in SSE support via @Sse() decorator. | HIGH |

### CLI Command Execution

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js child_process.spawn | Native (Node 22+) | CLI model invocation (v1) | Native Node.js API. spawn() provides streaming stdout/stderr, non-blocking I/O. Essential for the v1 CLI execution engine (`claude -p "..."` etc). No external dependency needed. | HIGH |

### Authentication & Security

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Passport.js | 0.7.x | Auth strategy framework | NestJS first-class integration via @nestjs/passport. v1: local strategy (username/password). Future: WeCom (enterprise WeChat) OAuth strategy. Pluggable architecture matches phased auth approach. | HIGH |
| JWT (@nestjs/jwt) | latest | Token-based auth | Stateless auth tokens. Works with Passport. NestJS built-in module. | HIGH |
| pgcrypto | PG extension | Field-level encryption | PostgreSQL native extension. Used for encrypting desensitization mappings (pgp_sym_encrypt/pgp_sym_decrypt). Already specified in storage architecture. | HIGH |
| bcrypt | 5.x | Password hashing | Industry standard for v1 username/password auth. | HIGH |

### UI Component Library

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Ant Design | 5.x | UI component library | Best Chinese enterprise UI library. Comprehensive components (tables, forms, modals, layout). Excellent i18n support for Chinese. Strong React ecosystem. Fits internal enterprise tool aesthetic. | MEDIUM |
| Tailwind CSS | 4.x | Utility CSS | Complements Ant Design for custom layouts and responsive design. React Flow UI components use Tailwind. v4 (released 2025) has significant improvements. | MEDIUM |

### Monitoring & Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Winston | 3.x | Structured logging | NestJS standard logging library. Supports multiple transports (file, console, remote). | MEDIUM |
| Bull Board | 5.x | Queue monitoring UI | Visual dashboard for BullMQ queues. Shows job status, retries, failures. Essential for debugging async operations. | MEDIUM |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| pnpm | 9.x | Package manager | Faster, disk-efficient, strict dependency resolution. Monorepo support via workspaces if needed. | MEDIUM |
| Vitest | 3.x | Testing | Vite-native test runner. Faster than Jest for Vite projects. Compatible with Jest API. NestJS v12 moving to Vitest. | MEDIUM |
| Docker Compose | latest | Local dev environment | PostgreSQL + Redis in containers. Consistent dev setup across team. | HIGH |

## Monorepo vs Separate Repos

**Recommendation: pnpm workspace monorepo** with two packages:

```
intelliflow/
  packages/
    backend/    # NestJS app
    frontend/   # React + Vite app
  pnpm-workspace.yaml
```

**Why monorepo:** Shared TypeScript types between frontend and backend (API contracts, SSE event types, workflow node definitions). Single CI pipeline. Easier to maintain for a small-to-medium team.

**Why NOT separate repos:** This is an internal tool, not a multi-team microservices architecture. Separate repos add deployment friction without benefit.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | NestJS | Fastify (raw) | Fastify is faster but lacks NestJS's DI, module system, guards, interceptors. This project needs enterprise-grade structure, not raw speed. NestJS can use Fastify adapter for performance. |
| Backend framework | NestJS | Express | Express lacks structure for a complex project. No DI, no module system, no built-in validation. |
| Frontend framework | Vite + React | Next.js | This is an internal SPA tool. SSR/SSG adds complexity without benefit. No SEO requirement. Vite is simpler, faster dev experience. |
| ORM | Prisma 7 | Drizzle ORM | Drizzle is lighter and closer to SQL, but Prisma's schema-first approach, migration tooling, and NestJS integration are better for this complex relational model with 15+ tables. Prisma 7's pure-TS rewrite eliminates previous performance concerns. |
| ORM | Prisma 7 | TypeORM | TypeORM has stale development, worse TypeScript inference, and more runtime bugs. Prisma is the clear winner in 2026. |
| Task queue | BullMQ | Agenda.js | Agenda uses MongoDB, not Redis. BullMQ is faster, more feature-rich, better maintained. |
| Workflow editor | React Flow | reaflow | reaflow has far less community adoption and fewer features. React Flow is the industry standard. |
| UI library | Ant Design | MUI (Material UI) | MUI is excellent but Ant Design is superior for Chinese enterprise contexts -- better i18n, more familiar to Chinese dev teams, more comprehensive table/form components. |
| Text editor | TipTap | Milkdown | Milkdown requires significantly more manual UI construction. TipTap has better out-of-the-box React integration and documentation. |
| PDF generation | md-to-pdf (Puppeteer) | Pandoc (via node-pandoc) | Pandoc requires system binary installation, complicates deployment. md-to-pdf is pure Node.js with Puppeteer. |

## Installation

```bash
# Initialize monorepo
pnpm init
# pnpm-workspace.yaml: packages: ['packages/*']

# Backend (packages/backend)
pnpm add @nestjs/core @nestjs/common @nestjs/platform-fastify
pnpm add @nestjs/passport passport passport-local passport-jwt @nestjs/jwt
pnpm add @prisma/client bullmq ioredis
pnpm add mammoth pdf-parse exceljs
pnpm add docx md-to-pdf
pnpm add bcrypt class-validator class-transformer
pnpm add winston @nestjs/config
pnpm add -D prisma typescript @types/node vitest
pnpm add -D @nestjs/cli @nestjs/testing

# Frontend (packages/frontend)
pnpm add react react-dom
pnpm add @xyflow/react @tiptap/react @tiptap/starter-kit @tiptap/extension-markdown
pnpm add antd @ant-design/icons
pnpm add @tanstack/react-query axios
pnpm add zustand  # lightweight state management
pnpm add -D vite @vitejs/plugin-react typescript tailwindcss
pnpm add -D vitest @testing-library/react
```

## Node.js Runtime

**Recommendation: Node.js 22 LTS** (current LTS as of 2026)

- Required by pdf-parse (>= 22.3.0 for v2.x)
- Native fetch API (no axios needed for backend HTTP calls)
- Improved child_process performance
- ESM support stable

## Key Version Constraints

| Dependency | Min Version | Reason |
|-----------|------------|--------|
| Node.js | 22.x LTS | pdf-parse 2.x requirement, ESM stability |
| PostgreSQL | 16+ | RLS improvements, pgcrypto stability |
| Redis | 7.x | BullMQ 5.x requirement |
| TypeScript | 5.7+ | Prisma 7 requirement, satisfies decorator support |

## Sources

- [NestJS Official Documentation](https://docs.nestjs.com/) -- HIGH confidence
- [NestJS v12 PR (Q3 2026)](https://github.com/nestjs/nest/pull/16391) -- HIGH confidence
- [Prisma 7 Release Announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- HIGH confidence
- [Prisma 7 Performance (InfoQ)](https://www.infoq.com/news/2026/01/prisma-7-performance/) -- HIGH confidence
- [React Flow / xyflow](https://reactflow.dev) -- HIGH confidence
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) -- v12.10.1 confirmed
- [BullMQ Official](https://bullmq.io/) -- HIGH confidence
- [mammoth npm](https://www.npmjs.com/package/mammoth) -- v1.12.0, HIGH confidence
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse) -- v2.4.5, HIGH confidence
- [exceljs npm](https://www.npmjs.com/package/exceljs) -- v4.4.x, HIGH confidence
- [md-to-pdf GitHub](https://github.com/simonhaenisch/md-to-pdf) -- MEDIUM confidence
- [TipTap Documentation](https://tiptap.dev/docs/editor/markdown) -- MEDIUM confidence
- [SSE Comeback 2025](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/) -- MEDIUM confidence
- [Vite vs Next.js 2026 Comparison](https://designrevision.com/blog/vite-vs-nextjs) -- MEDIUM confidence
- [Drizzle vs Prisma 2026 Comparison](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) -- MEDIUM confidence
- [pgcrypto PostgreSQL Docs](https://www.postgresql.org/docs/current/pgcrypto.html) -- HIGH confidence
