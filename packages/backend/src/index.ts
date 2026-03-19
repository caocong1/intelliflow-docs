import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { documentTypeRoutes } from "./modules/document-types/document-types.routes";
import { userRoutes } from "./modules/users/users.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(userRoutes)
  .use(documentTypeRoutes)
  .listen(3001);

console.log(`Backend running on http://localhost:${app.server?.port}`);

export type App = typeof app;
