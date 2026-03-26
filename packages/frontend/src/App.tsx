import { Navigate, Route, Router, useParams } from "@solidjs/router";
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
import ModelCallLogs from "./pages/admin/ModelCallLogs";
import StatsDashboard from "./pages/admin/StatsDashboard";
import ProjectList from "./pages/projects/ProjectList";
import ProjectHome from "./pages/projects/ProjectHome";
import ProjectSettings from "./pages/projects/ProjectSettings";
import VersionHistory from "./pages/documents/VersionHistory";
import Invitation from "./pages/Invitation";
import DocumentWorkspace from "./pages/workspace/DocumentWorkspace";

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
      <Route path="/invitation/:token" component={Invitation} />
      <Route path="/" component={AppLayout}>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={ProjectList} />
        <Route path="/projects/:id" component={ProjectHome} />
        <Route path="/projects/:id/settings" component={ProjectSettings} />
        {/* Documents: merged detail + workspace */}
        <Route path="/documents/:documentId" component={DocumentWorkspace} />
        <Route path="/documents/:documentId/versions" component={VersionHistory} />
        {/* Redirect old workspace URL */}
        <Route path="/workspace/:documentId" component={() => {
          const p = useParams<{ documentId: string }>();
          return <Navigate href={`/documents/${p.documentId}`} />;
        }} />
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
          path="/admin/model-call-logs"
          component={() => (
            <AdminRoute>
              <ModelCallLogs />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/stats"
          component={() => (
            <AdminRoute>
              <StatsDashboard />
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
