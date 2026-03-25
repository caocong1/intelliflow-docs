import Elysia, { t } from "elysia";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db";
import { users, projects, projectInvitations, projectMembers } from "../../db/schema";
import { createSession } from "../auth/auth.service";
import { requireAuth } from "../auth/auth.guard";
import {
  getUserInfoByCode,
  getUserSensitiveInfo,
  getMemberDetail,
  getDepartmentList,
  getDepartmentMembers,
  sendTextCardMessage,
} from "./wecom.service";

/**
 * 企业微信登录路由（无需认证）
 */
export const wecomAuthRoutes = new Elysia({ prefix: "/auth" })
  .get("/wecom-config", () => {
    const corpId = process.env.WECOM_CORP_ID;
    const agentId = process.env.WECOM_AGENT_ID;
    const redirectUri = process.env.WECOM_REDIRECT_URI;

    if (!corpId || !agentId || !redirectUri) {
      return { enabled: false as const };
    }

    return {
      enabled: true as const,
      corpId,
      agentId,
      redirectUri,
    };
  })
  .post(
    "/wecom-login",
    async ({ body, set }) => {
      // 1. 用 code 获取企业微信用户身份
      let userInfo: { userid?: string; openid?: string; user_ticket?: string };
      try {
        userInfo = await getUserInfoByCode(body.code);
      } catch (err) {
        set.status = 400;
        return { error: `企业微信认证失败: ${(err as Error).message}` };
      }

      // 2. 仅企业成员可登录
      if (!userInfo.userid) {
        set.status = 403;
        return { error: "非企业成员，无法登录" };
      }

      const wecomUserId = userInfo.userid;

      // 3. 如果有 user_ticket（OAuth2 snsapi_privateinfo），获取敏感信息
      let sensitiveInfo: Awaited<ReturnType<typeof getUserSensitiveInfo>> | null = null;
      if (userInfo.user_ticket) {
        try {
          sensitiveInfo = await getUserSensitiveInfo(userInfo.user_ticket);
        } catch (err) {
          console.warn("[wecom-login] 获取敏感信息失败:", (err as Error).message);
        }
      }

      // 4. 查找已有用户
      const existing = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          isActive: users.isActive,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.wecomUserId, wecomUserId))
        .limit(1);

      let user = existing[0];

      if (user) {
        if (!user.isActive) {
          set.status = 403;
          return { error: "账户已被禁用" };
        }
        // OAuth2 登录时更新联系信息
        if (sensitiveInfo) {
          await db.update(users).set({
            mobile: sensitiveInfo.mobile || undefined,
            avatar: sensitiveInfo.avatar || undefined,
            email: sensitiveInfo.email || sensitiveInfo.biz_mail || undefined,
          }).where(eq(users.id, user.id));
          user = { ...user, avatar: sensitiveInfo.avatar || user.avatar };
        }
      } else if (sensitiveInfo) {
        // 首次登录（仅 OAuth2 流程可创建用户）
        let memberDetail: Awaited<ReturnType<typeof getMemberDetail>>;
        try {
          memberDetail = await getMemberDetail(wecomUserId);
        } catch {
          memberDetail = {
            userid: wecomUserId, name: wecomUserId, department: [],
            position: "", mobile: "", email: "", avatar: "", status: 1, main_department: 0,
          };
        }

        const mobile = sensitiveInfo.mobile || "";
        const [newUser] = await db
          .insert(users)
          .values({
            username: mobile || memberDetail.name || `wecom_${wecomUserId}`,
            passwordHash: null,
            displayName: memberDetail.name || wecomUserId,
            role: "user",
            isActive: true,
            wecomUserId,
            mobile: mobile || null,
            avatar: sensitiveInfo.avatar || null,
            email: sensitiveInfo.email || sensitiveInfo.biz_mail || null,
          })
          .returning({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            role: users.role,
            avatar: users.avatar,
          });

        user = { ...newUser, isActive: true };
      } else {
        // 扫码登录但用户不存在 → 提示需要先在企业微信内登录
        set.status = 403;
        return { error: "首次登录请在企业微信内打开本应用完成注册" };
      }

      // 5. 创建 session
      const token = await createSession(user.id);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          avatar: user.avatar ?? null,
        },
      };
    },
    {
      body: t.Object({
        code: t.String(),
      }),
    },
  );

/**
 * 企业微信通讯录路由（需登录）
 */
export const wecomAdminRoutes = new Elysia({ prefix: "/wecom" })
  .use(requireAuth)
  .get("/departments", async ({ set }) => {
    try {
      const departments = await getDepartmentList();
      return { departments };
    } catch (err) {
      set.status = 500;
      return { error: `获取部门列表失败: ${(err as Error).message}` };
    }
  })
  .get(
    "/members/:departmentId",
    async ({ params, set }) => {
      try {
        const members = await getDepartmentMembers(Number(params.departmentId));
        return { members };
      } catch (err) {
        set.status = 500;
        return { error: `获取部门成员失败: ${(err as Error).message}` };
      }
    },
    {
      params: t.Object({
        departmentId: t.String(),
      }),
    },
  );

/**
 * 邀请公开路由（查看邀请信息，无需认证）
 */
export const invitationPublicRoutes = new Elysia()
  .get(
    "/invitation/:token",
    async ({ params, set }) => {
      const row = await db
        .select({
          id: projectInvitations.id,
          projectName: projects.name,
          inviterName: users.displayName,
          wecomName: projectInvitations.wecomName,
          status: projectInvitations.status,
          expiresAt: projectInvitations.expiresAt,
          createdAt: projectInvitations.createdAt,
        })
        .from(projectInvitations)
        .innerJoin(projects, eq(projectInvitations.projectId, projects.id))
        .innerJoin(users, eq(projectInvitations.inviterId, users.id))
        .where(eq(projectInvitations.token, params.token))
        .limit(1);

      if (!row[0]) {
        set.status = 404;
        return { error: "邀请不存在" };
      }

      const invitation = row[0];

      if (invitation.status === "pending" && new Date(invitation.expiresAt) < new Date()) {
        await db
          .update(projectInvitations)
          .set({ status: "expired" })
          .where(eq(projectInvitations.token, params.token));
        return { ...invitation, status: "expired" as const };
      }

      return invitation;
    },
    { params: t.Object({ token: t.String() }) },
  );

/**
 * 邀请认证路由（发送邀请、接受/拒绝，需登录）
 */
export const invitationRoutes = new Elysia()
  .use(requireAuth)
  .post(
    "/projects/:id/invite",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "未授权" };
      }

      // 检查是否是项目 owner
      const memberRow = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, params.id), eq(projectMembers.userId, user.id)))
        .limit(1);

      if (!memberRow[0] || memberRow[0].role !== "owner") {
        set.status = 403;
        return { error: "仅项目负责人可邀请成员" };
      }

      // 获取项目信息
      const projectRow = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, params.id))
        .limit(1);

      if (!projectRow[0]) {
        set.status = 404;
        return { error: "项目不存在" };
      }

      const projectName = projectRow[0].name;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const baseUrl = process.env.WECOM_REDIRECT_URI?.replace(/\/login$/, "") ?? "";
      const results: { wecomUserId: string; wecomName: string; success: boolean; error?: string }[] = [];

      for (const wecomUserId of body.wecomUserIds) {
        try {
          // 获取成员姓名
          let wecomName = wecomUserId;
          try {
            const detail = await getMemberDetail(wecomUserId);
            wecomName = detail.name || wecomUserId;
          } catch {
            // 忽略，用 userid 作为名字
          }

          // 生成邀请 token
          const token = crypto.randomUUID();

          // 创建邀请记录
          await db.insert(projectInvitations).values({
            projectId: params.id,
            inviterId: user.id,
            wecomUserId,
            wecomName,
            token,
            expiresAt,
          });

          results.push({ wecomUserId, wecomName, success: true });

          // 发送企业微信消息
          try {
            await sendTextCardMessage([wecomUserId], {
              title: "项目邀请",
              description: `<div class="gray">来自 ${user.displayName}</div><div class="normal">邀请你加入项目「${projectName}」</div>`,
              url: `${baseUrl}/invitation/${token}`,
              btntxt: "查看邀请",
            });
          } catch (err) {
            console.warn(`[invite] 消息发送失败 ${wecomUserId}:`, (err as Error).message);
          }
        } catch (err) {
          results.push({ wecomUserId, wecomName: wecomUserId, success: false, error: (err as Error).message });
        }
      }

      return { results };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ wecomUserIds: t.Array(t.String()) }),
    },
  )
  // 接受邀请
  .post(
    "/invitation/:token/accept",
    async ({ params, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "请先登录" };
      }

      const row = await db
        .select({
          id: projectInvitations.id,
          projectId: projectInvitations.projectId,
          status: projectInvitations.status,
          expiresAt: projectInvitations.expiresAt,
        })
        .from(projectInvitations)
        .where(eq(projectInvitations.token, params.token))
        .limit(1);

      if (!row[0]) {
        set.status = 404;
        return { error: "邀请不存在" };
      }

      const invitation = row[0];

      if (invitation.status !== "pending") {
        set.status = 400;
        return { error: `邀请已${invitation.status === "accepted" ? "接受" : invitation.status === "rejected" ? "拒绝" : "过期"}` };
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        await db.update(projectInvitations).set({ status: "expired" }).where(eq(projectInvitations.id, invitation.id));
        set.status = 400;
        return { error: "邀请已过期" };
      }

      // 检查是否已是成员
      const existingMember = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, invitation.projectId), eq(projectMembers.userId, user.id)))
        .limit(1);

      if (!existingMember[0]) {
        // 加入项目
        await db.insert(projectMembers).values({
          projectId: invitation.projectId,
          userId: user.id,
          role: "participant",
        });
      }

      // 更新邀请状态
      await db
        .update(projectInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(projectInvitations.id, invitation.id));

      return { success: true, projectId: invitation.projectId };
    },
    { params: t.Object({ token: t.String() }) },
  )
  // 拒绝邀请
  .post(
    "/invitation/:token/reject",
    async ({ params, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "请先登录" };
      }

      const row = await db
        .select({ id: projectInvitations.id, status: projectInvitations.status })
        .from(projectInvitations)
        .where(eq(projectInvitations.token, params.token))
        .limit(1);

      if (!row[0]) {
        set.status = 404;
        return { error: "邀请不存在" };
      }

      if (row[0].status !== "pending") {
        set.status = 400;
        return { error: "邀请已处理" };
      }

      await db
        .update(projectInvitations)
        .set({ status: "rejected" })
        .where(eq(projectInvitations.id, row[0].id));

      return { success: true };
    },
    { params: t.Object({ token: t.String() }) },
  );
