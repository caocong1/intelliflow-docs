import Elysia, { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { createSession } from "../auth/auth.service";
import { requireAdmin } from "../auth/auth.guard";
import {
  getUserInfoByCode,
  getUserSensitiveInfo,
  getMemberDetail,
  getDepartmentList,
  getDepartmentMembers,
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
 * 企业微信管理路由（需管理员权限）
 */
export const wecomAdminRoutes = new Elysia({ prefix: "/wecom" })
  .use(requireAdmin)
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
