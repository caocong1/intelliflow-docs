# Backend Technology Stack Research Report

> Date: 2026-03-19
> Context: IntelliFlow (智文平台) — Enterprise AI Document Generation Platform
> Constraint: Bun runtime for both frontend and backend; PostgreSQL 16; 50+ concurrent users

---

## 1. Runtime: Bun

**Latest Version: v1.3.11** (March 2026)

### Production Readiness

Bun is now 2-3 years post-1.0 and is stable enough for production use. It supports >95% of Node.js APIs, and popular frameworks like Express and millions of npm packages work without modification.

### Node.js API Compatibility for This Project

| API | Status | Notes |
|-----|--------|-------|
| `node:child_process` | Solid | `spawnSync` is 60% faster than Node.js. Used for CLI model calls (`claude -p "prompt"`) |
| `node:fs` | Full support | File system operations for temp workspaces, exports |
| `node:stream` | Supported | Needed for SSE streaming |
| `node:cluster` | Partial | Basic forking works; advanced coordination has edge cases |
| `node:worker_threads` | Supported with caveats | Some edge cases behave differently |

### Key Risks

- Open issue count (4.7k) is higher than Node.js (1.7k), indicating more unresolved edge cases
- Packages relying on `node-gyp` / N-API sometimes fail (popular ones like `sharp`, `bcrypt` work)
- `node:cluster` partial support could matter if scaling beyond single-process
- Smaller community for debugging obscure production issues

### Verdict

**Acceptable for this project.** The core APIs needed (child_process, fs, streams) are well-supported. The 50-user scale does not require cluster mode. Bun's built-in SQLite, test runner, and bundler reduce toolchain complexity.

---

## 2. Web Framework Comparison

### 2.1 ElysiaJS

**Latest Version: 1.4.27** (March 2026)

| Attribute | Assessment |
|-----------|------------|
| Maturity | Production-ready. Used by companies including Bank for Agriculture and Agricultural Co-operatives, CS.Money, Abacate Pay |
| Bun Compatibility | Built specifically for Bun; uses Bun's native APIs directly |
| Performance | Fastest Bun framework in micro-benchmarks due to static code analysis |
| Type Safety | End-to-end via Eden Treaty — no code generation needed |
| SSE Support | Built-in `sse()` utility; auto-sets headers, formats events |
| WebSocket | First-class support using Bun's native uWebSocket under the hood |
| File Upload | Native multipart/form-data with `t.File()` validation via TypeBox |
| Plugin System | Official plugins for CORS, static files, auth, Swagger/OpenAPI |
| GitHub Stars | ~10k+ |
| OpenAPI | Auto-generated from route schemas |

**Pros for IntelliFlow:**
- Eden Treaty provides end-to-end type safety with SolidJS frontend — no code generation, no OpenAPI specs needed. A proven [Bun + SolidJS + Elysia template](https://github.com/thedanchez/template-bun-solidjs-elysia) already exists.
- Built-in SSE support is critical for streaming model outputs
- TypeBox validation handles file upload security (extension spoofing prevention)
- Auto-generated OpenAPI docs useful for internal enterprise documentation
- Handles 2,000+ routes with complex validation without TypeScript "excessively deep" errors

**Cons for IntelliFlow:**
- Smaller ecosystem than Hono — fewer community middleware options
- Tightly coupled to Bun (if migration to Node.js ever needed, significant rewrite)
- Newer framework with less battle-testing at enterprise scale
- Some official plugins show limited recent maintenance (e.g., WebSocket plugin last updated ~1 year ago, though WebSocket is now built-in)

### 2.2 Hono

**Latest Version: 4.12.8** (March 2026)

| Attribute | Assessment |
|-----------|------------|
| Maturity | Production-ready. Widely adopted, larger community than Elysia |
| Bun Compatibility | Full support; one of multiple supported runtimes |
| Performance | Very fast on Bun; marginally slower than Elysia in micro-benchmarks, negligible in real apps |
| Type Safety | Good, but limited to ~100 routes with complex validation before TypeScript performance degrades |
| SSE Support | Supported via streaming helpers |
| WebSocket | Supported but less integrated than Elysia's native approach |
| File Upload | Supported via Web Standard APIs |
| Plugin System | Large middleware ecosystem; more community contributions than Elysia |
| GitHub Stars | ~25k+ |
| Multi-runtime | Runs on Bun, Deno, Cloudflare Workers, Node.js, AWS Lambda |

**Pros for IntelliFlow:**
- Larger community = more Stack Overflow answers, blog posts, examples
- Multi-runtime portability (safety net if Bun has issues in production)
- More mature middleware ecosystem
- Smaller bundle size (~14kB for hono/tiny)

**Cons for IntelliFlow:**
- No equivalent to Eden Treaty for end-to-end type safety with SolidJS
- Route-level type safety degrades at scale (>100 complex routes)
- Not Bun-optimized; doesn't use Bun-native APIs as deeply
- Would need separate RPC/client generation tool (e.g., openapi-typescript) for frontend type safety

### 2.3 Other Options Considered

| Framework | Notes |
|-----------|-------|
| **Encore.ts** | Claims 3x faster than Elysia/Hono, but opinionated infrastructure platform, not just a framework. Vendor lock-in risk. |
| **H3** | UnJS/Nuxt ecosystem. Good but Vue-centric community. No strong Bun optimization. |
| **Express/Fastify** | Work on Bun but are Node.js-first. No Bun-specific optimizations. |

### Framework Recommendation

**ElysiaJS is the stronger choice for this project** for these reasons:

1. **Eden Treaty + SolidJS** is the killer feature. End-to-end type safety from database schema to UI component without code generation eliminates an entire class of bugs in a document generation platform where data flows through multiple processing stages (input -> desensitize -> model call -> restore -> export).

2. **Built-in SSE** is first-class, not bolted on. Critical for streaming model outputs.

3. **Bun-native performance** matters when orchestrating multiple concurrent model calls for 50+ users.

4. The multi-runtime portability of Hono is a "nice to have" that this project doesn't need — the decision to use Bun is already made.

The main risk (smaller ecosystem) is mitigable because the platform's core complexity is in workflow orchestration and model management, not in needing dozens of third-party middleware.

---

## 3. ORM Comparison

### 3.1 Drizzle ORM (Recommended)

**Latest Version: 0.45.1** (stable; v1.0.0 beta in development)

| Attribute | Assessment |
|-----------|------------|
| Bun Compatibility | Full. Native `bun:sql` driver for PostgreSQL |
| Maturity | Production-ready. Surpassed Prisma in downloads in 2025 |
| Type Safety | Schema defined in TypeScript; queries type-checked against schema |
| Migrations | Auto-generated SQL files from schema changes via `drizzle-kit` |
| PostgreSQL Support | Full, including JSON, arrays, enums, custom types |
| Learning Curve | Moderate; SQL-like API is intuitive for developers who know SQL |
| Relational API | Built-in relational query API for joins without raw SQL |

**Pros for IntelliFlow:**
- Native Bun SQL driver (`bun:sql`) = no external PostgreSQL client library needed
- Schema-as-code approach aligns with the project's TypeScript-first strategy
- `drizzle-kit` handles migration generation and execution
- Lightweight — no query engine binary like Prisma
- SQL-first: complex queries for document metadata, workflow state, desensitization mappings are natural to express

**Cons:**
- Still pre-1.0 (0.45.x), though widely used in production
- Relational API is less powerful than Prisma's for deeply nested queries
- Smaller ecosystem of extensions compared to Prisma

### 3.2 Kysely

**Latest Version: 0.28.13**

| Attribute | Assessment |
|-----------|------------|
| Bun Compatibility | Full. `kysely-postgres-js` supports Bun's native SQL binding |
| Maturity | Stable, well-maintained |
| Type Safety | Stricter than Drizzle — validates queries themselves, not just results |
| Migrations | Manual up/down functions (more control, more work) |
| PostgreSQL Support | Full via official dialect |
| Learning Curve | Higher; query builder API has a learning curve |

**Pros for IntelliFlow:**
- Strictest type safety of any option — catches invalid queries at compile time
- Zero dependencies, lightweight
- Pure query builder with no ORM abstraction overhead

**Cons:**
- No auto-generated migrations (manual migration files)
- Requires external tools (kysely-codegen) to generate types from database
- Smaller community than Drizzle
- More verbose for common operations

### ORM Recommendation

**Drizzle ORM** is the better fit:
- Auto-generated migrations save significant development time
- Native Bun SQL driver eliminates dependency on external PostgreSQL clients
- Schema-as-code keeps the single source of truth in TypeScript
- Larger community and more resources for troubleshooting
- The slightly weaker query-level type safety (vs. Kysely) is an acceptable trade-off for the vastly better DX

---

## 4. Job Queue: BullMQ

**Latest Version: 5.71.0** (March 2026)

| Attribute | Assessment |
|-----------|------------|
| Bun Compatibility | Officially supported. Batch processing available for Bun |
| Maturity | Production-ready. Industry standard for Node.js/Bun job queues |
| Requires | Redis (additional infrastructure) |

**Use Cases in IntelliFlow:**
- Background document generation workflows
- Model call orchestration (parallel calls, retries, timeouts)
- File export processing
- Scheduled cleanup of temporary files

**Pros:**
- Battle-tested at scale, well-documented
- Job priorities, retries, delays, rate limiting, concurrency control
- Dashboard UI available (Bull Board) for monitoring
- Works with Bun out of the box

**Cons:**
- Requires Redis — adds operational complexity
- Redis is an additional infrastructure dependency beyond PostgreSQL

**Alternatives Considered:**

| Alternative | Assessment |
|-------------|------------|
| **PostgreSQL-based queues** (pg-boss, graphile-worker) | No Redis needed, but less performant at scale. pg-boss has uncertain Bun support. |
| **Bun.cron** (built-in, v1.3.11) | OS-level cron only. Not a job queue — no retries, no concurrency control, no persistence. |
| **Custom queue on PostgreSQL** | Possible but significant engineering effort to get right. |

**Recommendation:** Use BullMQ. The Redis dependency is justified by the reliability and feature set needed for orchestrating multi-step document generation workflows. Redis is simple to operate and can be a single instance at this scale.

---

## 5. Recommended Stack Summary

| Layer | Technology | Version | Confidence |
|-------|-----------|---------|------------|
| Runtime | Bun | 1.3.11 | High |
| Web Framework | ElysiaJS | 1.4.27 | High |
| Frontend-Backend Type Safety | Eden Treaty | (bundled with Elysia) | High |
| ORM | Drizzle ORM | 0.45.1 | High |
| Database | PostgreSQL | 18 | Decided |
| Job Queue | BullMQ | 5.71.0 | High |
| Job Queue Backend | Redis | latest | High |

### Architecture Diagram (Logical)

```
SolidJS + TailwindCSS (Frontend)
        |
        | Eden Treaty (end-to-end type-safe RPC)
        |
   ElysiaJS (API Layer)
   ├── SSE endpoints (model output streaming)
   ├── WebSocket (real-time workflow status)
   ├── REST endpoints (CRUD, file upload)
   └── File system operations (temp workspaces, exports)
        |
   ├── Drizzle ORM ──── PostgreSQL 16
   │   (metadata, text, desensitization mappings)
   │
   ├── BullMQ ──── Redis
   │   (workflow jobs, model calls, exports)
   │
   └── Bun.spawn ──── CLI model calls
       (claude -p "prompt")
```

### Key Risk Mitigations

1. **Bun stability risk**: Pin Bun version in CI/CD. Maintain a test suite that covers child_process usage patterns for model calls.
2. **ElysiaJS ecosystem risk**: The project needs few third-party plugins. Core requirements (SSE, WebSocket, file upload, validation) are all built-in.
3. **Drizzle pre-1.0 risk**: API is stable in practice. The 0.x version number reflects the team's conservatism, not instability. v1.0.0 beta is in progress.
4. **Vendor lock-in to Bun**: Accept this trade-off. The performance and DX benefits outweigh the portability concern for an internal enterprise tool.

---

## Sources

- [ElysiaJS Official Site](https://elysiajs.com)
- [ElysiaJS GitHub Releases](https://github.com/elysiajs/elysia/releases)
- [ElysiaJS npm](https://www.npmjs.com/package/elysia)
- [Elysia 1.4 - Supersymmetry](https://elysiajs.com/blog/elysia-v-encore)
- [ElysiaJS SSE / Handler Docs](https://elysiajs.com/essential/handler)
- [ElysiaJS WebSocket Docs](https://elysiajs.com/patterns/websocket)
- [Eden Treaty Overview](https://elysiajs.com/eden/overview)
- [Bun + SolidJS + Elysia Template](https://github.com/thedanchez/template-bun-solidjs-elysia)
- [Hono Official Site](https://hono.dev)
- [Hono npm](https://www.npmjs.com/package/hono)
- [Hono - Bun Getting Started](https://hono.dev/docs/getting-started/bun)
- [Hono GitHub Releases](https://github.com/honojs/hono/releases)
- [Elysia vs Hono for Solo Developers (2026)](https://solodevstack.com/blog/elysia-vs-hono-solo-developers)
- [How Hono and Elysia Are Challenging Express and Fastify](https://blog.adyog.com/how-hono-and-elysia-are-challenging-express-and-fastify/)
- [Drizzle ORM Official Site](https://orm.drizzle.team/)
- [Drizzle ORM - Bun SQL Driver](https://orm.drizzle.team/docs/connect-bun-sql)
- [Use Drizzle ORM with Bun](https://bun.com/docs/guides/ecosystem/drizzle)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm)
- [Drizzle ORM GitHub Releases](https://github.com/drizzle-team/drizzle-orm/releases)
- [Kysely Official Site](https://kysely.dev/)
- [Kysely npm](https://www.npmjs.com/package/kysely)
- [Kysely-postgres-js (Bun SQL support)](https://github.com/kysely-org/kysely-postgres-js)
- [Prisma vs Drizzle vs Kysely: TypeScript ORM Tier List 2026](https://www.pkgpulse.com/blog/prisma-vs-drizzle-vs-kysely-typescript-orm-tier-list)
- [Typed Query Builders: Kysely vs. Drizzle](https://marmelab.com/blog/2025/06/26/kysely-vs-drizzle.html)
- [BullMQ Official Site](https://bullmq.io/)
- [BullMQ npm](https://www.npmjs.com/package/bullmq)
- [BullMQ Docs](https://docs.bullmq.io)
- [BullMQ GitHub](https://github.com/taskforcesh/bullmq)
- [Bun Official Site](https://bun.com)
- [Bun Node.js Compatibility](https://bun.com/docs/runtime/nodejs-compat)
- [Bun GitHub Releases](https://github.com/oven-sh/bun/releases)
- [Bun Compatibility in 2026](https://www.alexcloudstar.com/blog/bun-compatibility-2026-npm-nodejs-nextjs/)
- [Bun vs Node.js: Is It Time to Switch in 2026?](https://dev.to/alexcloudstar/bun-vs-nodejs-is-it-time-to-switch-in-2026-5821)
- [Why We Ditched Node for Bun in 2026](https://dev.to/rayenmabrouk/why-we-ditched-node-for-bun-in-2026-and-why-you-should-too-48kg)
