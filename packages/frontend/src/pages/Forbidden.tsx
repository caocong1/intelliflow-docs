import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

const Forbidden: Component = () => {
  const navigate = useNavigate();

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-50">
      <div class="text-center max-w-sm px-6">
        {/* Shield icon */}
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <svg class="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>禁止访问</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <h1 class="text-7xl font-bold text-indigo-100 mb-3 leading-none select-none">403</h1>
        <h2 class="text-xl font-bold text-indigo-950 mb-2">无权访问</h2>
        <p class="text-sm text-slate-500 mb-8">您没有权限访问此页面，请联系管理员</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>返回</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </button>
      </div>
    </div>
  );
};

export default Forbidden;
