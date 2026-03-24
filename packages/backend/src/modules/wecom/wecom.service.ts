/**
 * 企业微信 API 服务模块
 * 负责 access_token 管理、用户身份获取、通讯录查询
 */

const WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin";

// access_token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

function getWecomConfig() {
  const corpId = process.env.WECOM_CORP_ID;
  const corpSecret = process.env.WECOM_CORP_SECRET;
  const agentId = process.env.WECOM_AGENT_ID;

  if (!corpId || !corpSecret || !agentId) {
    throw new Error("Missing WECOM_CORP_ID, WECOM_CORP_SECRET, or WECOM_AGENT_ID environment variables");
  }

  return { corpId, corpSecret, agentId };
}

/**
 * 获取 access_token（带缓存，2小时有效，提前5分钟刷新）
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const { corpId, corpSecret } = getWecomConfig();
  const url = `${WECOM_API_BASE}/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
    access_token?: string;
    expires_in?: number;
  };

  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`Failed to get access_token: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  // 提前 5 分钟刷新
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in! - 300) * 1000,
  };

  return data.access_token;
}

/**
 * 用登录授权码获取用户身份
 * 企业成员返回 userid，非成员返回 openid
 */
export async function getUserInfoByCode(code: string): Promise<{ userid?: string; openid?: string; user_ticket?: string }> {
  const accessToken = await getAccessToken();
  const url = `${WECOM_API_BASE}/auth/getuserinfo?access_token=${accessToken}&code=${code}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
    userid?: string;
    openid?: string;
    user_ticket?: string;
  };

  if (data.errcode !== 0) {
    throw new Error(`Failed to get user info: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return { userid: data.userid, openid: data.openid, user_ticket: data.user_ticket };
}

export type WecomUserDetail = {
  userid: string;
  gender: string;
  avatar: string;
  qr_code: string;
  mobile: string;
  email: string;
  biz_mail: string;
  address: string;
};

/**
 * 用 user_ticket 获取用户敏感信息（手机、邮箱、头像等）
 * 仅 OAuth2 snsapi_privateinfo 授权后可用
 */
export async function getUserSensitiveInfo(userTicket: string): Promise<WecomUserDetail> {
  const accessToken = await getAccessToken();
  const url = `${WECOM_API_BASE}/auth/getuserdetail?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ticket: userTicket }),
  });
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
  } & WecomUserDetail;

  if (data.errcode !== 0) {
    throw new Error(`Failed to get user detail: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  console.log("[wecom] auth/getuserdetail 完整返回:", JSON.stringify(data, null, 2));

  return {
    userid: data.userid,
    gender: data.gender,
    avatar: data.avatar,
    qr_code: data.qr_code,
    mobile: data.mobile,
    email: data.email,
    biz_mail: data.biz_mail,
    address: data.address,
  };
}

export type WecomMember = {
  userid: string;
  name: string;
  department: number[];
  position: string;
  mobile: string;
  email: string;
  avatar: string;
  status: number;
  main_department: number;
};

/**
 * 读取成员详情
 */
export async function getMemberDetail(userid: string): Promise<WecomMember> {
  const accessToken = await getAccessToken();
  const url = `${WECOM_API_BASE}/user/get?access_token=${accessToken}&userid=${userid}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
  } & WecomMember;

  if (data.errcode !== 0) {
    throw new Error(`Failed to get member detail: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  console.log("[wecom] user/get 完整返回:", JSON.stringify(data, null, 2));

  return {
    userid: data.userid,
    name: data.name,
    department: data.department,
    position: data.position,
    mobile: data.mobile,
    email: data.email,
    avatar: data.avatar,
    status: data.status,
    main_department: data.main_department,
  };
}

export type WecomDepartment = {
  id: number;
  name: string;
  name_en: string;
  parentid: number;
  order: number;
};

/**
 * 获取部门列表
 */
export async function getDepartmentList(id?: number): Promise<WecomDepartment[]> {
  const accessToken = await getAccessToken();
  let url = `${WECOM_API_BASE}/department/list?access_token=${accessToken}`;
  if (id !== undefined) {
    url += `&id=${id}`;
  }

  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
    department?: WecomDepartment[];
  };

  if (data.errcode !== 0) {
    throw new Error(`Failed to get department list: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return data.department ?? [];
}

/**
 * 获取部门成员详情列表
 */
export async function getDepartmentMembers(departmentId: number): Promise<WecomMember[]> {
  const accessToken = await getAccessToken();
  const url = `${WECOM_API_BASE}/user/list?access_token=${accessToken}&department_id=${departmentId}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
    userlist?: WecomMember[];
  };

  if (data.errcode !== 0) {
    throw new Error(`Failed to get department members: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return data.userlist ?? [];
}

/**
 * 发送 textcard 应用消息
 * @param toUserIds 接收人企业微信 userid 数组
 */
export async function sendTextCardMessage(
  toUserIds: string[],
  card: { title: string; description: string; url: string; btntxt?: string },
): Promise<void> {
  const accessToken = await getAccessToken();
  const { agentId } = getWecomConfig();
  const url = `${WECOM_API_BASE}/message/send?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      touser: toUserIds.join("|"),
      agentid: Number(agentId),
      msgtype: "textcard",
      textcard: {
        title: card.title,
        description: card.description,
        url: card.url,
        btntxt: card.btntxt ?? "查看详情",
      },
    }),
  });

  const data = (await res.json()) as { errcode: number; errmsg: string };
  if (data.errcode !== 0) {
    throw new Error(`Failed to send message: ${data.errmsg} (errcode: ${data.errcode})`);
  }
}
