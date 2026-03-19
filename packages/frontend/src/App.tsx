import { Navigate, Route, Router } from "@solidjs/router";
import type { Component, ParentComponent } from "solid-js";
import { Show } from "solid-js";
import { AuthProvider, useAuth } from "./contexts/auth";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";
import Login from "./pages/Login";

const AdminRoute: ParentComponent = (props) => {
  const auth = useAuth();
  return (
    <Show when={auth.isAdmin()} fallback={<Forbidden />}>
      {props.children}
    </Show>
  );
};

const AdminUsersPlaceholder: Component = () => (
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900">用户管理</h1>
    <p class="mt-4 text-base text-gray-500">功能开发中...</p>
  </div>
);

const AdminDocTypesPlaceholder: Component = () => (
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900">文档类型管理</h1>
    <p class="mt-4 text-base text-gray-500">功能开发中...</p>
  </div>
);

const App: Component = () => {
  return (
    <Router>
      <AuthProvider>
        <Route
          path="/login"
          component={() => (
            <AuthLayout>
              <Login />
            </AuthLayout>
          )}
        />
        <Route path="/" component={AppLayout}>
          <Route path="/" component={Dashboard} />
          <Route
            path="/admin/users"
            component={() => (
              <AdminRoute>
                <AdminUsersPlaceholder />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/document-types"
            component={() => (
              <AdminRoute>
                <AdminDocTypesPlaceholder />
              </AdminRoute>
            )}
          />
        </Route>
        <Route path="*" component={() => <Navigate href="/" />} />
      </AuthProvider>
    </Router>
  );
};

export default App;
