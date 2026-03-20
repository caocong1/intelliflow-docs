import Elysia, { t } from "elysia";
import { requireAuth } from "../auth/auth.guard";
import {
  addMember,
  createProject,
  deleteProject,
  getProject,
  isProjectMember,
  isProjectOwner,
  leaveProject,
  listMembers,
  listProjects,
  removeMember,
  updateMemberRole,
  updateProject,
} from "./projects.service";

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(requireAuth)

  // ─── Project CRUD ────────────────────────────────────────────────────────────

  .get(
    "/",
    async ({ query, user }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 20;
      const tab = (query.tab as "created" | "joined" | "all") || "all";
      const search = query.search || undefined;
      const { data, total } = await listProjects(user!.id, tab, page, pageSize, search);
      return { data, total, page, pageSize };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        tab: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  .post(
    "/",
    async ({ body, user, set }) => {
      try {
        const project = await createProject(user!.id, body);
        set.status = 201;
        return project;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("23505") || message.includes("unique")) {
          set.status = 409;
          return { error: "Project name conflict" };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
        department: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )

  .get(
    "/:id",
    async ({ params, user, set }) => {
      const project = await getProject(params.id, user!.id);
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }
      return project;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const owner = await isProjectOwner(params.id, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "Only project owner can update project" };
      }
      const updated = await updateProject(params.id, body);
      if (!updated) {
        set.status = 404;
        return { error: "Project not found" };
      }
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(t.String({ maxLength: 1000 })),
        department: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )

  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const owner = await isProjectOwner(params.id, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "Only project owner can delete project" };
      }
      const deleted = await deleteProject(params.id);
      if (!deleted) {
        set.status = 404;
        return { error: "Project not found" };
      }
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Member Management ──────────────────────────────────────────────────────

  .get(
    "/:id/members",
    async ({ params, user, set }) => {
      const member = await isProjectMember(params.id, user!.id);
      if (!member) {
        set.status = 403;
        return { error: "Only project members can view member list" };
      }
      return await listMembers(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .post(
    "/:id/members",
    async ({ params, body, user, set }) => {
      const owner = await isProjectOwner(params.id, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "Only project owner can add members" };
      }
      try {
        const member = await addMember(params.id, body.userId, body.role as "owner" | "participant" | undefined);
        set.status = 201;
        return member;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "ALREADY_MEMBER") {
          set.status = 409;
          return { error: "User is already a member" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        userId: t.String(),
        role: t.Optional(t.Union([t.Literal("owner"), t.Literal("participant")])),
      }),
    },
  )

  .delete(
    "/:id/members/:userId",
    async ({ params, user, set }) => {
      const owner = await isProjectOwner(params.id, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "Only project owner can remove members" };
      }
      try {
        await removeMember(params.id, params.userId);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "NOT_A_MEMBER") {
          set.status = 404;
          return { error: "User is not a member" };
        }
        if (message === "SOLE_OWNER") {
          set.status = 409;
          return { error: "Cannot remove sole owner" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String(), userId: t.String() }),
    },
  )

  .post(
    "/:id/leave",
    async ({ params, user, set }) => {
      try {
        await leaveProject(params.id, user!.id);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "NOT_A_MEMBER") {
          set.status = 404;
          return { error: "You are not a member of this project" };
        }
        if (message === "SOLE_OWNER") {
          set.status = 409;
          return { error: "Cannot leave as sole owner — transfer ownership first" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .patch(
    "/:id/members/:userId/role",
    async ({ params, body, user, set }) => {
      const owner = await isProjectOwner(params.id, user!.id);
      if (!owner) {
        set.status = 403;
        return { error: "Only project owner can change member roles" };
      }
      try {
        const updated = await updateMemberRole(params.id, params.userId, body.role);
        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "NOT_A_MEMBER") {
          set.status = 404;
          return { error: "User is not a member" };
        }
        if (message === "SOLE_OWNER") {
          set.status = 409;
          return { error: "Cannot demote sole owner" };
        }
        throw err;
      }
    },
    {
      params: t.Object({ id: t.String(), userId: t.String() }),
      body: t.Object({
        role: t.Union([t.Literal("owner"), t.Literal("participant")]),
      }),
    },
  );
