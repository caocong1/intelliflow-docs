import { Navigate, Route, Router } from "@solidjs/router";
import type { Component, ParentComponent } from "solid-js";
import { Show } from "solid-js";
import ToastContainer from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./contexts/auth";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";
import Login from "./pages/Login";
import DocumentTypeManagement from "./pages/admin/DocumentTypeManagement";
import UserManagement from "./pages/admin/UserManagement";

const AdminRoute: ParentComponent = (props) => {
  const auth = useAuth();
  return (
    <Show when={auth.isAdmin()} fallback={<Forbidden />}>
      {props.children}
    </Show>
  );
};

const App: Component = () => {
  return (
    <Router
      root={(props) => (
        <AuthProvider>
          <ToastContainer />
          {props.children}
        </AuthProvider>
      )}
    >
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
              <UserManagement />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/document-types"
          component={() => (
            <AdminRoute>
              <DocumentTypeManagement />
            </AdminRoute>
          )}
        />
      </Route>
      <Route path="*" component={() => <Navigate href="/" />} />
    </Router>
  );
};

export default App;
