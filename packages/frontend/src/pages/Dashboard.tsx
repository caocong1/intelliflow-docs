import type { Component } from "solid-js";
import { useAuth } from "../contexts/auth";

const Dashboard: Component = () => {
  const auth = useAuth();
  const user = auth.user;

  return (
    <div class="p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">欢迎回来, {user()?.displayName}</h1>

      <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
        {user()?.role === "admin" ? "管理员" : "普通用户"}
      </div>

      <div class="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <p class="text-base text-gray-500">仪表盘功能正在开发中...</p>
      </div>
    </div>
  );
};

export default Dashboard;
