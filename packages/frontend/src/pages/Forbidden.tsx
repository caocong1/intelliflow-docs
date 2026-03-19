import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

const Forbidden: Component = () => {
  const navigate = useNavigate();

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-300 mb-4">403</h1>
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">无权访问</h2>
        <p class="text-base text-gray-600 mb-8">您没有权限访问此页面</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          class="px-6 py-2 text-base font-medium text-white bg-blue-600 rounded-md cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
        >
          返回
        </button>
      </div>
    </div>
  );
};

export default Forbidden;
