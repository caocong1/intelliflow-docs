import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import { PptAgentPublicError, type PptAgentService, createDefaultPptAgentService } from "./service";

type PptAgentRoutesOptions = {
  service?: PptAgentService;
};

let defaultServicePromise: Promise<PptAgentService> | null = null;

async function getDefaultService(): Promise<PptAgentService> {
  defaultServicePromise ??= createDefaultPptAgentService();
  return defaultServicePromise;
}

function getPublicError(err: unknown): { status: number; error: string } {
  if (err instanceof PptAgentPublicError) {
    return { status: err.status, error: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 400, error: message };
}

export function createPptAgentRoutes(options: PptAgentRoutesOptions = {}) {
  const resolveService = async () => options.service ?? (await getDefaultService());

  return new Elysia({ prefix: "/ppt-agent" })
    .use(requireAuth)
    .post(
      "/jobs",
      async ({ body, user, set }) => {
        if (!user?.id) {
          set.status = 401;
          return { error: "未授权" };
        }

        try {
          const service = await resolveService();
          const job = await service.createAndStartJob(user.id, body);
          set.status = 201;
          return job;
        } catch (err) {
          const publicError = getPublicError(err);
          set.status = publicError.status;
          return { error: publicError.error };
        }
      },
      {
        body: t.Object({
          prompt: t.String({ minLength: 1, maxLength: 12000 }),
          slideCount: t.Optional(t.Number({ minimum: 1, maximum: 30 })),
          style: t.Optional(t.String({ maxLength: 80 })),
        }),
      },
    )
    .get("/jobs", async ({ user, set }) => {
      if (!user?.id) {
        set.status = 401;
        return { error: "未授权" };
      }
      const service = await resolveService();
      return { jobs: await service.listJobs(user.id) };
    })
    .get(
      "/jobs/:id",
      async ({ params, user, set }) => {
        if (!user?.id) {
          set.status = 401;
          return { error: "未授权" };
        }
        const service = await resolveService();
        const job = await service.getJob(user.id, params.id);
        if (!job) {
          set.status = 404;
          return { error: "PPT 生成任务不存在" };
        }
        return job;
      },
      { params: t.Object({ id: t.String() }) },
    )
    .get(
      "/jobs/:id/download",
      async ({ params, user, set }) => {
        if (!user?.id) {
          set.status = 401;
          return { error: "未授权" };
        }

        try {
          const service = await resolveService();
          const result = await service.getDownload(user.id, params.id);
          set.headers["content-type"] = result.mimeType;
          set.headers["content-length"] = String(result.size);
          set.headers["content-disposition"] =
            `attachment; filename="${encodeURIComponent(result.filename)}"`;
          return new Response(new Uint8Array(result.buffer), {
            headers: {
              "Content-Type": result.mimeType,
              "Content-Length": String(result.size),
              "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
            },
          });
        } catch (err) {
          const publicError = getPublicError(err);
          set.status = publicError.status;
          return { error: publicError.error };
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}

export const pptAgentRoutes = createPptAgentRoutes();
