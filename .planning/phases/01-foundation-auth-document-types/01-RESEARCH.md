# Phase 1: Foundation + Auth + Document Types - Research

**Researched:** 2026-03-19
**Domain:** Full-stack application scaffolding, authentication, RBAC, CRUD management
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire application foundation: a pnpm workspace monorepo with Bun runtime, ElysiaJS backend, SolidJS frontend, Drizzle ORM with PostgreSQL, and Tailwind CSS v4. The authentication system uses username/password login with JWT tokens stored in HTTP-only cookies, session persistence across browser refresh, and role-based access control (admin vs regular user). Admin-only features include user account management and document type CRUD with search.

The stack is well-suited for this phase. ElysiaJS provides built-in guard/beforeHandle lifecycle hooks ideal for RBAC middleware. Bun offers native `Bun.password` for argon2/bcrypt hashing without external dependencies. Drizzle ORM's type-safe schema definitions pair naturally with Eden Treaty's end-to-end type safety. Tailwind CSS v4 integrates directly with Vite via `@tailwindcss/vite` plugin — no PostCSS config needed.

**Primary recommendation:** Structure as a pnpm workspace monorepo with `packages/backend`, `packages/frontend`, and `packages/shared` (shared types). Use ElysiaJS guard + beforeHandle for auth middleware, JWT in HTTP-only cookies for session persistence, and Drizzle ORM push-based migrations during development.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 管理员与普通用户不分离：同一个应用、同一套布局，管理员只是多看到管理相关的菜单项
- 管理菜单项与普通菜单项混合排列，管理员能看到更多项，普通用户看不到管理项
- 管理员同时也是普通用户，拥有普通用户的所有功能 + 管理功能
- 普通用户尝试直接访问管理页面 URL 时，显示 403 无权访问提示页，带返回按钮

### Claude's Discretion
- 整体应用布局结构（侧边栏 vs 顶部导航）
- 登录页面设计风格
- 用户/文档类型管理列表的展示方式（表格 vs 卡片、弹窗 vs 新页面编辑）
- 错误提示和表单验证的交互方式
- 会话超时行为
- 首次登录引导

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | 用户可通过用户名和密码登录系统 | ElysiaJS JWT plugin + Bun.password for hashing + HTTP-only cookie storage |
| AUTH-02 | 管理员可创建、编辑、停用用户账号 | Drizzle ORM user table with status field + ElysiaJS CRUD routes behind admin guard |
| AUTH-03 | 用户登录后系统根据角色展示对应功能 | Frontend auth context (SolidJS createSignal/createStore) + conditional nav rendering |
| AUTH-04 | 用户会话在浏览器刷新后保持登录状态 | JWT in HTTP-only cookie auto-sent on refresh + /me endpoint to restore session |
| DTYPE-01 | 管理员可创建文档类型（名称、编码、描述） | Drizzle pgTable schema + ElysiaJS validated POST route behind admin guard |
| DTYPE-02 | 管理员可编辑文档类型信息 | ElysiaJS PATCH/PUT route with Drizzle update + input validation |
| DTYPE-03 | 管理员可启用/停用文档类型 | Boolean `is_active` field in schema + toggle endpoint |
| DTYPE-04 | 管理员可删除文档类型（仅无关联文档时） | Drizzle relation check before delete + appropriate error response |
| DTYPE-05 | 管理员可查看文档类型列表并搜索 | Drizzle `ilike` query for search + paginated list endpoint |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.3+ | JavaScript runtime | Native speed, built-in TS, built-in password hashing (argon2/bcrypt) |
| ElysiaJS | 1.x | HTTP framework | Type-safe, guard/derive lifecycle, Eden Treaty integration |
| @elysiajs/jwt | latest | JWT auth | Official plugin, integrates with ElysiaJS cookie system |
| @elysiajs/eden | latest | E2E type safety | RPC-like client, <2KB, no codegen needed |
| Drizzle ORM | latest | Database ORM | Type-safe schema, SQL-like queries, push/migrate workflows |
| drizzle-kit | latest | Migration tool | Schema push for dev, generate+migrate for production |
| PostgreSQL | 18 | Database | Relational, ACID, RLS support, pgcrypto for future encryption |
| SolidJS | 1.x | Frontend framework | Fine-grained reactivity (signals), no virtual DOM, small bundle |
| @solidjs/router | latest | Client routing | Universal router, preload pattern for auth guards |
| Tailwind CSS | 4.x | Styling | Vite plugin, no PostCSS config, CSS-first configuration |
| @tailwindcss/vite | latest | Vite integration | Direct Vite plugin, replaces PostCSS setup from v3 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | 6.x | Build tool | Frontend dev server and production builds |
| vite-plugin-solid | latest | SolidJS Vite plugin | JSX/TSX compilation for SolidJS |
| postgres (pg driver) | latest | PG driver for Drizzle | `drizzle-orm/bun-sql` uses Bun's built-in SQL, or use `postgres` package |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JWT in cookies | Session tokens in DB | JWT is stateless (no DB lookup per request), but can't revoke individual tokens without a blocklist |
| @elysiajs/jwt | better-auth | better-auth is more full-featured (OAuth, email verification) but heavier for simple username/password |
| Bun.password (argon2) | bcryptjs | Bun.password is native C++ binding, no npm dependency needed |
| Drizzle push (dev) | Full migrations | Push is faster for dev iteration; use generate+migrate for production |

**Installation:**
```bash
# Backend
pnpm add elysia @elysiajs/jwt @elysiajs/eden drizzle-orm

# Backend dev
pnpm add -D drizzle-kit @types/bun

# Frontend
pnpm add solid-js @solidjs/router

# Frontend dev
pnpm add -D vite vite-plugin-solid tailwindcss @tailwindcss/vite
```

## Architecture Patterns

### Recommended Project Structure
```
intelliflow/
├── pnpm-workspace.yaml
├── package.json                    # Root scripts, shared dev deps
├── packages/
│   ├── backend/
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/               # Generated migrations
│   │   └── src/
│   │       ├── index.ts           # App entry, Elysia instance
│   │       ├── db/
│   │       │   ├── schema.ts      # All Drizzle table definitions
│   │       │   ├── index.ts       # DB connection + drizzle instance
│   │       │   └── seed.ts        # Seed admin user
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   │   ├── auth.routes.ts
│   │       │   │   ├── auth.service.ts
│   │       │   │   └── auth.guard.ts
│   │       │   ├── users/
│   │       │   │   ├── users.routes.ts
│   │       │   │   └── users.service.ts
│   │       │   └── document-types/
│   │       │       ├── document-types.routes.ts
│   │       │       └── document-types.service.ts
│   │       └── common/
│   │           ├── middleware.ts    # Global middleware
│   │           └── errors.ts       # Error handling
│   ├── frontend/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── index.tsx          # Entry point
│   │       ├── App.tsx            # Router + layout shell
│   │       ├── api/
│   │       │   └── client.ts      # Eden Treaty client
│   │       ├── contexts/
│   │       │   └── auth.tsx       # Auth context provider
│   │       ├── layouts/
│   │       │   ├── AppLayout.tsx   # Sidebar + nav shell
│   │       │   └── AuthLayout.tsx  # Login page layout
│   │       ├── pages/
│   │       │   ├── Login.tsx
│   │       │   ├── Dashboard.tsx
│   │       │   ├── admin/
│   │       │   │   ├── UserManagement.tsx
│   │       │   │   └── DocumentTypeManagement.tsx
│   │       │   └── Forbidden.tsx   # 403 page
│   │       └── components/
│   │           ├── ui/            # Reusable UI components
│   │           └── nav/           # Navigation components
│   └── shared/
│       ├── package.json
│       └── src/
│           └── types.ts           # Shared type exports
```

### Pattern 1: ElysiaJS Guard + Derive for Auth Middleware

**What:** Use `derive` to extract user from JWT cookie on every request, then `guard` with `beforeHandle` to restrict admin routes.
**When to use:** Every authenticated/authorized route.
**Example:**
```typescript
// auth.guard.ts
import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'

export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  .derive(async ({ jwt, cookie: { token } }) => {
    const payload = await jwt.verify(token.value)
    return { user: payload || null }
  })

export const requireAuth = new Elysia({ name: 'requireAuth' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
    }
  })

export const requireAdmin = new Elysia({ name: 'requireAdmin' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, set }) => {
      if (!user || user.role !== 'admin') {
        set.status = 403
        return { error: 'Forbidden' }
      }
    }
  })
```

### Pattern 2: SolidJS Auth Context with Route Protection

**What:** Create an auth context provider that stores user state and provides login/logout methods. Use layout components to protect route groups.
**When to use:** Frontend auth state management and route protection.
**Example:**
```typescript
// contexts/auth.tsx
import { createContext, createSignal, useContext, ParentComponent } from 'solid-js'
import { api } from '../api/client'

const AuthContext = createContext<AuthContextValue>()

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null)
  const [loading, setLoading] = createSignal(true)

  // Restore session on mount (AUTH-04)
  onMount(async () => {
    try {
      const { data } = await api.auth.me.get()
      if (data) setUser(data)
    } finally {
      setLoading(false)
    }
  })

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)!
```

### Pattern 3: Eden Treaty Client Setup in Monorepo

**What:** Export the Elysia app type from backend, import it in frontend for type-safe API calls.
**When to use:** All frontend-to-backend API communication.
**Example:**
```typescript
// Backend: src/index.ts
const app = new Elysia()
  .use(authRoutes)
  .use(userRoutes)
  .use(documentTypeRoutes)
  .listen(3000)

export type App = typeof app

// Frontend: src/api/client.ts
import { treaty } from '@elysiajs/eden'
import type { App } from '@intelliflow/backend'

export const api = treaty<App>('localhost:3000')
```

### Pattern 4: Drizzle Schema with Enums and Relations

**What:** Define database schema using Drizzle's pgTable with proper types, enums, and relations.
**When to use:** All database table definitions.
**Example:**
```typescript
// db/schema.ts
import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'user'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const documentTypes = pgTable('document_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

### Anti-Patterns to Avoid
- **Storing JWT in localStorage:** Vulnerable to XSS. Use HTTP-only cookies instead.
- **Checking roles only on frontend:** Always enforce RBAC on backend with guards. Frontend checks are UX-only.
- **Sharing Elysia instance (not type):** Only export `type App = typeof app` to frontend, never the actual instance.
- **Using `drizzle-kit migrate` in development:** Use `drizzle-kit push` for fast iteration during dev; reserve migrations for staging/production.
- **Putting all routes in one file:** Use ElysiaJS plugin pattern to split routes by module (auth, users, document-types).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | `Bun.password.hash()` / `Bun.password.verify()` | Native C++ binding, supports argon2id by default, runs in worker thread |
| JWT signing/verification | Custom crypto | `@elysiajs/jwt` plugin | Handles signing, verification, expiry, integrates with ElysiaJS context |
| Cookie management | Manual Set-Cookie headers | ElysiaJS reactive cookies | Automatic encoding/decoding, signature verification, proxy-based API |
| Database migrations | Raw SQL scripts | `drizzle-kit push` (dev) / `drizzle-kit generate` + `migrate` (prod) | Schema diffing, type generation, rollback support |
| API client | Custom fetch wrapper | Eden Treaty (`@elysiajs/eden`) | End-to-end type safety, <2KB, auto-generated from server types |
| Form validation | Custom validators | ElysiaJS built-in validation (t.Object/t.String) | Type-safe, auto-generates OpenAPI docs, shared with Eden |

**Key insight:** This stack is designed for tight integration. ElysiaJS + Eden Treaty + Drizzle form a type-safe pipeline from database schema to API response to frontend consumption. Breaking any link (e.g., hand-rolling an API client) loses the chain of type safety.

## Common Pitfalls

### Pitfall 1: pnpm Workspace Type Sharing
**What goes wrong:** Frontend can't resolve backend types because pnpm workspace linking isn't configured properly.
**Why it happens:** The `shared` or backend package isn't listed as a workspace dependency in the frontend's package.json.
**How to avoid:** In `pnpm-workspace.yaml`, list all packages. In frontend's `package.json`, add `"@intelliflow/backend": "workspace:*"`. Only import `type` — never runtime code from backend.
**Warning signs:** TypeScript errors about missing modules, Eden Treaty losing type inference.

### Pitfall 2: JWT Cookie Not Sent Cross-Origin
**What goes wrong:** Frontend dev server (port 3000) can't send cookies to backend (port 3001) due to CORS and cookie SameSite rules.
**Why it happens:** By default, cookies with `SameSite=Lax` aren't sent cross-origin, and `credentials: 'include'` isn't set.
**How to avoid:** Configure ElysiaJS CORS plugin with `credentials: true` and `origin` set to frontend URL. Set cookie `sameSite: 'lax'` and `path: '/'`. Use Vite proxy in development to avoid cross-origin entirely.
**Warning signs:** Login succeeds but subsequent requests return 401.

### Pitfall 3: SolidJS Reactivity Broken by Destructuring
**What goes wrong:** Signal values stop updating in the UI after destructuring props or context values.
**Why it happens:** SolidJS uses a proxy-based reactivity system. Destructuring breaks the proxy chain, capturing a static value instead of a reactive reference.
**How to avoid:** Never destructure props in SolidJS components. Access `props.user` directly, or use `mergeProps`/`splitProps` helpers.
**Warning signs:** UI shows stale data after state changes, components don't re-render.

### Pitfall 4: Drizzle Schema Push Dropping Data
**What goes wrong:** `drizzle-kit push` drops and recreates columns/tables when schema changes are ambiguous (e.g., renaming a column).
**Why it happens:** Push mode infers intent from schema diff; renames look like drop+add.
**How to avoid:** For renames, use `drizzle-kit generate` to create a migration file, then edit it manually. During early development (no real data), push is fine.
**Warning signs:** Data loss after schema changes in staging.

### Pitfall 5: ElysiaJS Plugin Scope and Hook Ordering
**What goes wrong:** Guards or derive don't apply to routes, or apply too broadly.
**Why it happens:** ElysiaJS plugins have scoping rules. Hooks defined in `.guard()` apply to routes registered **after** that call within the same instance.
**How to avoid:** Use named plugins (`new Elysia({ name: 'auth' })`) and `.use()` them explicitly where needed. Test guard behavior with a simple endpoint first.
**Warning signs:** Protected routes accessible without auth, or public routes requiring auth.

### Pitfall 6: Missing Seed Data for Admin User
**What goes wrong:** No way to log in after initial deployment because there's no admin user.
**Why it happens:** The system requires an existing admin to create users, creating a chicken-and-egg problem.
**How to avoid:** Create a seed script (`db/seed.ts`) that creates a default admin user with a known password. Run it on first deployment. Log the credentials to console.
**Warning signs:** Blank login page with no way to create first account.

## Code Examples

### Login Flow (Backend)
```typescript
// Source: ElysiaJS JWT plugin docs + Bun.password docs
// auth.routes.ts
import { Elysia, t } from 'elysia'

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  .post('/login', async ({ body, jwt, cookie: { token }, set }) => {
    const user = await db.select().from(users)
      .where(eq(users.username, body.username))
      .limit(1)

    if (!user[0] || !user[0].isActive) {
      set.status = 401
      return { error: 'Invalid credentials' }
    }

    const valid = await Bun.password.verify(body.password, user[0].passwordHash)
    if (!valid) {
      set.status = 401
      return { error: 'Invalid credentials' }
    }

    const jwtToken = await jwt.sign({
      sub: user[0].id,
      role: user[0].role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
    })

    token.set({
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    })

    return { user: { id: user[0].id, username: user[0].username, role: user[0].role } }
  }, {
    body: t.Object({
      username: t.String({ minLength: 1 }),
      password: t.String({ minLength: 1 })
    })
  })
  .get('/me', async ({ user }) => {
    // Requires authPlugin derive
    if (!user) return { user: null }
    const found = await db.select().from(users).where(eq(users.id, user.sub)).limit(1)
    return { user: found[0] ? { id: found[0].id, username: found[0].username, role: found[0].role } : null }
  })
```

### Drizzle DB Connection
```typescript
// Source: Drizzle ORM Bun docs
// db/index.ts
import { drizzle } from 'drizzle-orm/bun-sql'
import { Database } from 'bun:sqlite' // or use postgres driver
import * as schema from './schema'

export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  schema,
})
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
```

### Vite Config (Frontend)
```typescript
// Source: Tailwind CSS v4 SolidJS guide
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'  // Proxy to backend, avoids CORS issues
    }
  },
  build: { target: 'esnext' }
})
```

### Frontend Route Protection
```typescript
// Source: SolidJS router docs + community patterns
// App.tsx
import { Router, Route, Navigate } from '@solidjs/router'
import { Show } from 'solid-js'
import { useAuth } from './contexts/auth'

const ProtectedRoute = (props) => {
  const { user, loading } = useAuth()
  return (
    <Show when={!loading()} fallback={<Loading />}>
      <Show when={user()} fallback={<Navigate href="/login" />}>
        {props.children}
      </Show>
    </Show>
  )
}

const AdminRoute = (props) => {
  const { user } = useAuth()
  return (
    <Show when={user()?.role === 'admin'} fallback={<Forbidden />}>
      {props.children}
    </Show>
  )
}
```

### Seed Script
```typescript
// db/seed.ts
import { db } from './index'
import { users } from './schema'

const passwordHash = await Bun.password.hash('admin123', { algorithm: 'argon2id' })

await db.insert(users).values({
  username: 'admin',
  passwordHash,
  displayName: 'System Administrator',
  role: 'admin',
  isActive: true,
}).onConflictDoNothing()

console.log('Seed complete. Default admin: admin / admin123')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + PostCSS + content globs | Tailwind v4 + `@tailwindcss/vite` plugin + CSS `@import` | Jan 2025 | No postcss.config.js, no tailwind.config.js, CSS-first config |
| Drizzle `drizzle-orm/postgres-js` | `drizzle-orm/bun-sql` (Bun native SQL) | Bun 1.2+ | Native Bun SQL driver, no external postgres package needed |
| ElysiaJS 0.x lifecycle | ElysiaJS 1.x with named plugins + scoped guards | 2024-2025 | Better plugin composition, clearer hook scoping |
| SolidJS createEffect for data fetching | SolidJS createResource / router preload | SolidJS 1.8+ | Better data loading patterns, SSR-ready |

**Deprecated/outdated:**
- `postcss.config.js` + `tailwind.config.js`: Not needed with Tailwind v4
- `@elysiajs/lucia-auth`: Lucia Auth v3 has its own integration patterns; check if still maintained
- `drizzle-orm/node-postgres`: Use `drizzle-orm/bun-sql` when running on Bun runtime

## Discretion Recommendations

Based on the user's delegation of UI/UX decisions to Claude's discretion:

### Layout: Sidebar Navigation (Recommended)
**Why:** Admin panels and internal tools conventionally use sidebar navigation. It scales better with growing menu items across phases (auth, AI config, workflows, projects, documents). The sidebar naturally accommodates the mixed admin+user menu items requirement.

### Login Page: Clean Centered Card
**Why:** Standard enterprise internal tool pattern. Single card with username/password fields, logo at top, minimal distractions.

### Management Lists: Table with Inline Actions
**Why:** Tables are the standard for admin CRUD interfaces. Support sorting, search, and dense information display. Use slide-over panel or modal for create/edit forms — avoids full page navigation for simple forms.

### Error/Validation: Inline Field Errors + Toast Notifications
**Why:** Inline errors next to form fields for validation. Toast notifications for success/failure of operations. Both are standard patterns that don't require custom implementation.

### Session Timeout: 7-Day JWT Expiry
**Why:** Internal tool used daily. 7-day expiry balances security and convenience. On expiry, redirect to login page with "session expired" message.

### First Login: No Special Guidance
**Why:** Phase 1 is admin-focused. Admin users receive credentials from the seed script. No onboarding flow needed. Can be added in future phases if regular users need guidance.

## Open Questions

1. **Bun SQL vs postgres.js driver for Drizzle**
   - What we know: Bun 1.2+ has a built-in SQL module (`bun:sql`) that Drizzle supports via `drizzle-orm/bun-sql`. The alternative is the `postgres` npm package.
   - What's unclear: Stability of `bun:sql` for production use. Bun docs mention known issues with concurrent statements in 1.2.0.
   - Recommendation: Start with `postgres` npm package (proven stable), switch to `bun:sql` once it matures. Both use the same Drizzle API surface.

2. **Eden Treaty in pnpm workspace type resolution**
   - What we know: Eden Treaty requires importing `type App` from the backend package. In a pnpm workspace, this needs proper workspace protocol linking.
   - What's unclear: Whether the backend needs to be built first or if TypeScript project references handle it live.
   - Recommendation: Use TypeScript project references (`references` in tsconfig.json) for live type checking. Add `"@intelliflow/backend": "workspace:*"` to frontend's package.json.

3. **CORS configuration for development**
   - What we know: Vite proxy (`/api` -> backend) eliminates CORS issues in development.
   - What's unclear: Production deployment topology (same origin? reverse proxy?).
   - Recommendation: Use Vite proxy for dev. Design API routes under `/api` prefix so a reverse proxy (nginx) can route easily in production.

## Sources

### Primary (HIGH confidence)
- [ElysiaJS Cookie docs](https://elysiajs.com/patterns/cookie) - Reactive cookies, signing, configuration
- [ElysiaJS JWT Plugin](https://elysiajs.com/plugins/jwt) - JWT signing, verification, cookie-based auth
- [ElysiaJS Lifecycle](https://elysiajs.com/essential/life-cycle) - derive, guard, beforeHandle hooks
- [ElysiaJS Guard Tutorial](https://elysiajs.com/tutorial/getting-started/guard/) - Guard pattern for route protection
- [ElysiaJS Eden Treaty](https://elysiajs.com/eden/treaty/overview) - E2E type-safe API client
- [Bun Password API](https://bun.com/docs/guides/util/hash-a-password) - Built-in argon2/bcrypt hashing
- [Drizzle ORM + Bun](https://orm.drizzle.team/docs/get-started/bun-sql-new) - Drizzle setup with Bun
- [Tailwind CSS v4 + SolidJS](https://tailwindcss.com/docs/installation/framework-guides/solidjs) - Official installation guide
- [SolidJS Router](https://docs.solidjs.com/solid-router) - Routing, preload, redirect
- [SolidJS createSignal](https://docs.solidjs.com/reference/basic-reactivity/create-signal) - Reactive state primitives
- [SolidJS createStore](https://docs.solidjs.com/reference/store-utilities/create-store) - Object/array reactive state
- [pnpm Workspaces](https://pnpm.io/workspaces) - Monorepo workspace configuration

### Secondary (MEDIUM confidence)
- [SolidJS community discussions](https://github.com/solidjs/solid-router/discussions/364) - Protected route patterns
- [ElysiaJS Better Auth integration](https://elysiajs.com/integrations/better-auth) - Alternative auth approach (not recommended for v1)

### Tertiary (LOW confidence)
- Bun SQL concurrent statement issues — mentioned in Bun GitHub issues, needs validation for current Bun version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official documentation
- Architecture: HIGH - Patterns derived from official docs and well-established conventions
- Pitfalls: HIGH - Common issues documented in official sources and community discussions

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days — stack is stable, no major releases expected)
