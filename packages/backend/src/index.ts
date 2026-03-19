import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .listen(3001);

console.log(`Backend running on http://localhost:${app.server?.port}`);

export type App = typeof app;
