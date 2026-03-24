import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import {
  createVersionSnapshot,
  getVersion,
  getVersionDiff,
  isDocumentProjectMember,
  listVersions,
} from "./versions.service";

export const versionRoutes = new Elysia({ prefix: "/versions" })
  .use(requireAuth)

  // ─── Create version snapshot ────────────────────────────────────────────────

  .post(
    "/",
    async ({ body, user, set }) => {
      const isMember = await isDocumentProjectMember(body.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可创建版本快照" };
      }

      try {
        const version = await createVersionSnapshot(
          body.documentId,
          body.nodeId,
          body.nodeLabel,
          body.snapshotData as Record<string, unknown>,
          user!.id,
        );
        set.status = 201;
        return version;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("23503") || message.includes("foreign key")) {
          set.status = 400;
          return { error: "无效的文档ID" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        documentId: t.String(),
        nodeId: t.String(),
        nodeLabel: t.String(),
        snapshotData: t.Record(t.String(), t.Unknown()),
      }),
    },
  )

  // ─── List versions for a document ─────────────────────────────────────────

  .get(
    "/",
    async ({ query, user, set }) => {
      const documentId = query.documentId;
      if (!documentId) {
        set.status = 400;
        return { error: "缺少文档ID" };
      }

      const isMember = await isDocumentProjectMember(documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可查看版本" };
      }

      const versions = await listVersions(documentId);
      return { data: versions };
    },
    {
      query: t.Object({
        documentId: t.String(),
      }),
    },
  )

  // ─── Get single version ───────────────────────────────────────────────────

  .get(
    "/:id",
    async ({ params, user, set }) => {
      const version = await getVersion(params.id);
      if (!version) {
        set.status = 404;
        return { error: "版本不存在" };
      }

      const isMember = await isDocumentProjectMember(version.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可查看版本" };
      }

      return version;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Diff two versions ────────────────────────────────────────────────────

  .get(
    "/:id/diff/:idB",
    async ({ params, user, set }) => {
      // Check version A exists and user has access
      const versionA = await getVersion(params.id);
      if (!versionA) {
        set.status = 404;
        return { error: "版本A不存在" };
      }

      const isMember = await isDocumentProjectMember(versionA.documentId, user!.id);
      if (!isMember) {
        set.status = 403;
        return { error: "仅项目成员可查看版本差异" };
      }

      const diffResult = await getVersionDiff(params.id, params.idB);
      if (!diffResult) {
        set.status = 404;
        return { error: "一个或两个版本不存在" };
      }

      return diffResult;
    },
    {
      params: t.Object({ id: t.String(), idB: t.String() }),
    },
  );
