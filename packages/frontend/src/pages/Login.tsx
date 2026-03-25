import { useNavigate, useSearchParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show, createSignal, onMount, onCleanup } from "solid-js";
import { useAuth } from "../contexts/auth";
import { fetchWecomConfig } from "../lib/wecom-config";

/** 检测是否在企业微信内置浏览器中 */
function isWecomBrowser(): boolean {
  return /wxwork/i.test(navigator.userAgent);
}

const Login: Component = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [showPasswordLogin, setShowPasswordLogin] = createSignal(false);
  const [wecomEnabled, setWecomEnabled] = createSignal(false);
  const [configLoading, setConfigLoading] = createSignal(true);
  const [oauthRedirecting, setOauthRedirecting] = createSignal(false);

  // Password login fields
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");

  function navigateAfterLogin() {
    const pendingToken = localStorage.getItem("pending_invitation");
    if (pendingToken) {
      localStorage.removeItem("pending_invitation");
      navigate(`/invitation/${pendingToken}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  // If already logged in, redirect
  if (auth.user()) {
    navigateAfterLogin();
  }

  let wwLoginInstance: { unmount: () => void } | null = null;

  onMount(async () => {
    const config = await fetchWecomConfig();
    setConfigLoading(false);

    if (!config.enabled) {
      setShowPasswordLogin(true);
      return;
    }

    setWecomEnabled(true);

    // 企业微信内置浏览器：走 OAuth2 流程
    if (isWecomBrowser()) {
      const oauthCode = searchParams.code;
      if (oauthCode) {
        // 从 OAuth2 回调回来，用 code 登录
        setSubmitting(true);
        handleWecomLogin(Array.isArray(oauthCode) ? oauthCode[0] : oauthCode);
      } else {
        // 跳转到 OAuth2 授权页
        setOauthRedirecting(true);
        const redirectUri = encodeURIComponent(config.redirectUri);
        const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_privateinfo&state=${state}&agentid=${config.agentId}#wechat_redirect`;
        window.location.href = oauthUrl;
      }
      return;
    }

    // 外部浏览器：显示扫码登录面板
    try {
      const ww = await import("@wecom/jssdk");
      wwLoginInstance = ww.createWWLoginPanel({
        el: "#ww_login",
        params: {
          login_type: ww.WWLoginType.corpApp,
          appid: config.corpId,
          agentid: config.agentId,
          redirect_uri: config.redirectUri,
          state: Math.random().toString(36).slice(2) + Date.now().toString(36),
          redirect_type: ww.WWLoginRedirectType.callback,
          panel_size: ww.WWLoginPanelSizeType.small,
          lang: ww.WWLoginLangType.zh,
        },
        onLoginSuccess({ code }: { code: string }) {
          handleWecomLogin(code);
        },
        onLoginFail(err) {
          setError(`企业微信登录失败: ${err.errMsg ?? "未知错误"}`);
        },
      });
    } catch (err) {
      console.error("Failed to load @wecom/jssdk:", err);
      setWecomEnabled(false);
      setShowPasswordLogin(true);
    }
  });

  onCleanup(() => {
    wwLoginInstance?.unmount();
  });

  const handleWecomLogin = async (code: string) => {
    setError("");
    setSubmitting(true);

    const result = await auth.wecomLogin(code);

    if (result.success) {
      navigateAfterLogin();
    } else {
      setError(result.error ?? "企业微信登录失败");
    }

    setSubmitting(false);
  };

  const handlePasswordSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await auth.login(username(), password());

    if (result.success) {
      navigateAfterLogin();
    } else {
      setError(result.error ?? "登录失败");
    }

    setSubmitting(false);
  };

  return (
    <div class="min-h-screen flex flex-col md:flex-row">
      {/* Left branding panel */}
      <div class="md:w-[45%] bg-indigo-950 flex flex-col items-center justify-center p-10 md:p-16 relative overflow-hidden min-h-[220px] md:min-h-screen">
        {/* Decorative circles */}
        <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-800/30 blur-3xl" />
        <div class="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-indigo-700/20 blur-3xl" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-indigo-700/20" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-indigo-600/15" />

        <div class="relative z-10 text-center md:text-left max-w-sm">
          {/* Logo mark */}
          <div class="flex items-center justify-center md:justify-start gap-3 mb-8">
            <div class="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>IntelliFlow</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="text-xl font-bold text-white tracking-tight">IntelliFlow</span>
          </div>

          <h2 class="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            智能文档<br class="hidden md:block" />流程平台
          </h2>
          <p class="text-indigo-300 text-base leading-relaxed">
            通过 AI 驱动的节点编排，快速产出高质量文档
          </p>

          {/* Feature list */}
          <ul class="mt-8 space-y-3 hidden md:block">
            <li class="flex items-center gap-2.5 text-sm text-indigo-200">
              <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>check</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
              </svg>
              多模型并行生成与对比
            </li>
            <li class="flex items-center gap-2.5 text-sm text-indigo-200">
              <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>check</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
              </svg>
              自由编排文档生成流程
            </li>
            <li class="flex items-center gap-2.5 text-sm text-indigo-200">
              <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <title>check</title>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
              </svg>
              智能信息脱敏与恢复
            </li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div class="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12 md:px-12">
        <div class="w-full max-w-sm">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-indigo-950">欢迎回来</h1>
            <p class="mt-1.5 text-sm text-slate-500">请登录您的账户继续使用</p>
          </div>

          {/* Loading states */}
          <Show when={configLoading() || oauthRedirecting() || (isWecomBrowser() && submitting())}>
            <div class="flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500">
              <svg class="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <title>加载中</title>
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="font-medium text-indigo-600">
                {configLoading() ? "加载中..." : oauthRedirecting() ? "正在跳转企业微信授权..." : "正在登录..."}
              </p>
            </div>
          </Show>

          <Show when={!configLoading()}>
            {/* Error message */}
            <Show when={error()}>
              <div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 mb-4">
                <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <title>错误</title>
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
                <p class="text-sm text-red-600">{error()}</p>
              </div>
            </Show>

            {/* WeChat Work login panel */}
            <Show when={wecomEnabled()}>
              <div class="mb-4">
                <p class="text-sm font-medium text-slate-700 mb-3">企业微信登录</p>
                <div class="relative rounded-lg border border-slate-200 bg-white overflow-hidden" style={{ "min-height": "380px" }}>
                  <div id="ww_login" class="flex items-center justify-center" style={{ "min-height": "380px" }} />
                  <Show when={submitting()}>
                    <div class="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                      <svg class="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <title>登录中</title>
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p class="text-sm font-medium text-indigo-600">正在验证身份...</p>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Divider */}
            <Show when={wecomEnabled()}>
              <div class="relative my-5">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-slate-200" />
                </div>
                <div class="relative flex justify-center text-xs">
                  <button
                    type="button"
                    class="bg-slate-50 px-3 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                    onClick={() => setShowPasswordLogin(!showPasswordLogin())}
                  >
                    {showPasswordLogin() ? "收起账号登录" : "使用账号密码登录"}
                  </button>
                </div>
              </div>
            </Show>

            {/* Password login form */}
            <Show when={showPasswordLogin() || !wecomEnabled()}>
              <form onSubmit={handlePasswordSubmit} class="space-y-5">
                <div>
                  <label for="username" class="block text-sm font-medium text-slate-700 mb-1.5">
                    用户名
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    class="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    placeholder="请输入用户名"
                  />
                </div>

                <div>
                  <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">
                    密码
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    class="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    placeholder="请输入密码"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting()}
                  class="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-lg cursor-pointer hover:from-indigo-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
                >
                  {submitting() ? (
                    <span class="flex items-center justify-center gap-2">
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <title>加载中</title>
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      登录中...
                    </span>
                  ) : "登录"}
                </button>
              </form>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Login;
