import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { documentTypeRoutes } from "./modules/document-types/document-types.routes";
import { modelRoutes } from "./modules/models/models.routes";
import { providerRoutes } from "./modules/providers/providers.routes";
import { userRoutes } from "./modules/users/users.routes";
import { workflowRoutes } from "./modules/workflows/workflows.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(userRoutes)
  .use(documentTypeRoutes)
  .use(providerRoutes)
  .use(modelRoutes)
  .use(workflowRoutes)
  .listen({ port: 3001, hostname: "0.0.0.0" });

console.log(`Backend running on http://localhost:${app.server?.port}`);

export type App = typeof app;
