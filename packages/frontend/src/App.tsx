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
import ModelConfiguration from "./pages/admin/ModelConfiguration";
import UserManagement from "./pages/admin/UserManagement";
import WorkflowManagement from "./pages/admin/WorkflowManagement";
import WorkflowEditor from "./pages/admin/WorkflowEditor";
import ProjectList from "./pages/projects/ProjectList";
import ProjectHome from "./pages/projects/ProjectHome";
import ProjectSettings from "./pages/projects/ProjectSettings";
import DocumentDetail from "./pages/documents/DocumentDetail";
import VersionHistory from "./pages/documents/VersionHistory";

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
        <Route path="/projects" component={ProjectList} />
        <Route path="/projects/:id" component={ProjectHome} />
        <Route path="/projects/:id/settings" component={ProjectSettings} />
        <Route path="/documents/:id" component={DocumentDetail} />
        <Route path="/documents/:id/versions" component={VersionHistory} />
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
        <Route
          path="/admin/model-config"
          component={() => (
            <AdminRoute>
              <ModelConfiguration />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/workflows"
          component={() => (
            <AdminRoute>
              <WorkflowManagement />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/workflows/:id/edit"
          component={() => (
            <AdminRoute>
              <WorkflowEditor />
            </AdminRoute>
          )}
        />
      </Route>
      <Route path="*" component={() => <Navigate href="/" />} />
    </Router>
  );
};

export default App;
