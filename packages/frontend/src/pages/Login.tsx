import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show, createSignal } from "solid-js";
import { useAuth } from "../contexts/auth";

const Login: Component = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  // If already logged in, redirect
  if (auth.user()) {
    navigate("/", { replace: true });
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await auth.login(username(), password());

    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error ?? "Login failed");
    }

    setSubmitting(false);
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">IntelliFlow</h1>
          <p class="mt-2 text-base text-gray-600">智能文档流程平台</p>
        </div>

        <form onSubmit={handleSubmit} class="space-y-6">
          <div>
            <label for="username" class="block text-base font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              id="username"
              type="text"
              required
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="w-full px-4 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label for="password" class="block text-base font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              class="w-full px-4 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="请输入密码"
            />
          </div>

          <Show when={error()}>
            <p class="text-sm text-red-600">{error()}</p>
          </Show>

          <button
            type="submit"
            disabled={submitting()}
            class="w-full py-2 px-4 text-base font-medium text-white bg-blue-600 rounded-md cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting() ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
