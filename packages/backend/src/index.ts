import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import {
  documentTypeAdminRoutes,
  documentTypeReadRoutes,
} from "./modules/document-types/document-types.routes";
import { documentMgmtRoutes } from "./modules/documents/documents.routes";
import { fileRoutes } from "./modules/files/files.routes";
import { modelAdminRoutes, modelReadRoutes } from "./modules/models/models.routes";
import { projectRoutes } from "./modules/projects/projects.routes";
import { providerRoutes } from "./modules/providers/providers.routes";
import { userAdminRoutes, userReadRoutes } from "./modules/users/users.routes";
import { runtimeRoutes } from "./modules/runtime/runtime.routes";
import { inputTransformRoutes } from "./modules/runtime/input-transform.routes";
import { desensitizeRoutes } from "./modules/runtime/desensitize.routes";
import { exportRoutes } from "./modules/runtime/export.routes";
import { modelCallRoutes } from "./modules/runtime/model-call.routes";
import { restoreRoutes } from "./modules/runtime/restore.routes";
import { modelCallLogRoutes } from "./modules/runtime/model-call-log.routes";
import { promptOptimizeRoutes } from "./modules/prompts";
import { versionRoutes } from "./modules/versions/versions.routes";
import { wecomAuthRoutes, wecomAdminRoutes } from "./modules/wecom/wecom.routes";
import { workflowAdminRoutes, workflowReadRoutes } from "./modules/workflows/workflows.routes";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(wecomAuthRoutes)
  .use(wecomAdminRoutes)
  .use(userReadRoutes)
  .use(userAdminRoutes)
  .use(documentTypeReadRoutes)
  .use(documentTypeAdminRoutes)
  .use(providerRoutes)
  .use(modelReadRoutes)
  .use(modelAdminRoutes)
  .use(workflowReadRoutes)
  .use(workflowAdminRoutes)
  .use(projectRoutes)
  .use(documentMgmtRoutes)
  .use(versionRoutes)
  .use(fileRoutes)
  .use(runtimeRoutes)
  .use(inputTransformRoutes)
  .use(desensitizeRoutes)
  .use(exportRoutes)
  .use(modelCallRoutes)
  .use(restoreRoutes)
  .use(modelCallLogRoutes)
  .use(promptOptimizeRoutes)
  .listen({ port: 3001, hostname: "0.0.0.0" });

console.log(`Backend running on http://localhost:${app.server?.port}`);

export type App = typeof app;
