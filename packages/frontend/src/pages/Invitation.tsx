import { useNavigate, useParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show, createSignal, onMount } from "solid-js";
import { useAuth } from "../contexts/auth";

type InvitationInfo = {
  id: string;
  projectName: string;
  inviterName: string;
  wecomName: string | null;
  status: "pending" | "accepted" | "rejected" | "expired";
  expiresAt: string;
  createdAt: string;
};

const Invitation: Component = () => {
  const params = useParams<{ token: string }>();
  const auth = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = createSignal<InvitationInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [accepting, setAccepting] = createSignal(false);
  const [rejecting, setRejecting] = createSignal(false);
  const [done, setDone] = createSignal(false);

  onMount(async () => {
    try {
      const res = await fetch(`/api/invitation/${params.token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "邀请不存在");
        return;
      }
      setInvitation(data as InvitationInfo);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  });

  async function handleAccept() {
    if (!auth.user()) {
      // 未登录，保存 token 后跳转登录
      localStorage.setItem("pending_invitation", params.token);
      navigate("/login", { replace: true });
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch(`/api/invitation/${params.token}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "接受邀请失败");
        return;
      }
      setDone(true);
      // 跳转到项目页
      setTimeout(() => {
        navigate(`/projects/${data.projectId}`, { replace: true });
      }, 1500);
    } catch {
      setError("网络错误");
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    if (!auth.user()) {
      navigate("/login", { replace: true });
      return;
    }

    setRejecting(true);
    try {
      const res = await fetch(`/api/invitation/${params.token}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "拒绝邀请失败");
        return;
      }
      setInvitation((prev) => (prev ? { ...prev, status: "rejected" } : null));
    } catch {
      setError("网络错误");
    } finally {
      setRejecting(false);
    }
  }

  const statusLabels: Record<string, { text: string; color: string }> = {
    pending: { text: "待处理", color: "text-amber-600 bg-amber-50 border-amber-200" },
    accepted: { text: "已接受", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    rejected: { text: "已拒绝", color: "text-red-600 bg-red-50 border-red-200" },
    expired: { text: "已过期", color: "text-slate-600 bg-slate-50 border-slate-200" },
  };

  return (
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="flex items-center justify-center gap-2 mb-8">
          <div class="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-md">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>IntelliFlow</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span class="text-lg font-bold text-indigo-950">IntelliFlow</span>
        </div>

        {/* Card */}
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Loading */}
          <Show when={loading()}>
            <div class="flex items-center justify-center py-16 text-sm text-slate-400">
              <svg class="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <title>加载中</title>
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              加载邀请信息...
            </div>
          </Show>

          {/* Error */}
          <Show when={!loading() && error() && !invitation()}>
            <div class="p-8 text-center">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <title>错误</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p class="text-sm text-slate-600">{error()}</p>
            </div>
          </Show>

          {/* Invitation info */}
          <Show when={!loading() && invitation()}>
            {(inv) => {
              const info = inv();
              const status = statusLabels[info.status];
              const isPending = info.status === "pending";

              return (
                <>
                  {/* Header */}
                  <div class="px-6 pt-6 pb-4 text-center">
                    <div class="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                      <svg class="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>邀请</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <h2 class="text-lg font-semibold text-slate-900 mb-1">项目邀请</h2>
                    <p class="text-sm text-slate-500">
                      <span class="font-medium text-slate-700">{info.inviterName}</span> 邀请你加入项目
                    </p>
                  </div>

                  {/* Project info */}
                  <div class="mx-6 mb-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p class="text-base font-semibold text-slate-900">{info.projectName}</p>
                    <p class="text-xs text-slate-400 mt-1">
                      邀请时间：{new Date(info.createdAt).toLocaleString("zh-CN")}
                    </p>
                    <p class="text-xs text-slate-400">
                      有效期至：{new Date(info.expiresAt).toLocaleString("zh-CN")}
                    </p>
                  </div>

                  {/* Status badge (non-pending) */}
                  <Show when={!isPending}>
                    <div class="px-6 pb-6 text-center">
                      <span class={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                  </Show>

                  {/* Done message */}
                  <Show when={done()}>
                    <div class="px-6 pb-6 text-center">
                      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <title>成功</title>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        已加入项目，正在跳转...
                      </span>
                    </div>
                  </Show>

                  {/* Error */}
                  <Show when={error()}>
                    <div class="mx-6 mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                      {error()}
                    </div>
                  </Show>

                  {/* Actions (pending only) */}
                  <Show when={isPending && !done()}>
                    <div class="px-6 pb-6 flex gap-3">
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={rejecting()}
                        class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {rejecting() ? "处理中..." : "拒绝"}
                      </button>
                      <button
                        type="button"
                        onClick={handleAccept}
                        disabled={accepting()}
                        class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {accepting() ? "处理中..." : auth.user() ? "接受邀请" : "登录并接受"}
                      </button>
                    </div>
                  </Show>
                </>
              );
            }}
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Invitation;
