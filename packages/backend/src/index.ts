import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { documentTypeReadRoutes, documentTypeAdminRoutes } from "./modules/document-types/document-types.routes";
import { modelRoutes } from "./modules/models/models.routes";
import { providerRoutes } from "./modules/providers/providers.routes";
import { userReadRoutes, userAdminRoutes } from "./modules/users/users.routes";
import { projectRoutes } from "./modules/projects/projects.routes";
import { workflowReadRoutes, workflowAdminRoutes } from "./modules/workflows/workflows.routes";
import { documentMgmtRoutes } from "./modules/documents/documents.routes";
import { versionRoutes } from "./modules/versions/versions.routes";
import { fileRoutes } from "./modules/files/files.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(userReadRoutes)
  .use(userAdminRoutes)
  .use(documentTypeReadRoutes)
  .use(documentTypeAdminRoutes)
  .use(providerRoutes)
  .use(modelRoutes)
  .use(workflowReadRoutes)
  .use(workflowAdminRoutes)
  .use(projectRoutes)
  .use(documentMgmtRoutes)
  .use(versionRoutes)
  .use(fileRoutes)
  .listen({ port: 3001, hostname: "0.0.0.0" });

console.log(`Backend running on http://localhost:${app.server?.port}`);

export type App = typeof app;
