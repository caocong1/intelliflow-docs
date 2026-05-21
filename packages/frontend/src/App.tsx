import { Navigate, Route, Router, useParams } from "@solidjs/router";
import type { Component, ParentComponent } from "solid-js";
import { Show } from "solid-js";
import ToastContainer from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./contexts/auth";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Favorites from "./pages/Favorites";
import Forbidden from "./pages/Forbidden";
import Invitation from "./pages/Invitation";
import Login from "./pages/Login";
import PptGenerator from "./pages/PptGenerator";
import RecentAccess from "./pages/RecentAccess";
import Search from "./pages/Search";
import DocumentTypeManagement from "./pages/admin/DocumentTypeManagement";
import ModelCallLogs from "./pages/admin/ModelCallLogs";
import ModelConfiguration from "./pages/admin/ModelConfiguration";
import PptTemplateManagement from "./pages/admin/PptTemplateManagement";
import PptTemplateProfileEditor from "./pages/admin/PptTemplateProfileEditor";
import StatsDashboard from "./pages/admin/StatsDashboard";
import UserManagement from "./pages/admin/UserManagement";
import WorkflowEditor from "./pages/admin/WorkflowEditor";
import WorkflowManagement from "./pages/admin/WorkflowManagement";
import VersionHistory from "./pages/documents/VersionHistory";
import ProjectHome from "./pages/projects/ProjectHome";
import ProjectList from "./pages/projects/ProjectList";
import ProjectSettings from "./pages/projects/ProjectSettings";
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
        <Route path="/search" component={Search} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/recent" component={RecentAccess} />
        <Route path="/ppt-generator" component={PptGenerator} />
        {/* Redirect old workspace URL */}
        <Route
          path="/workspace/:documentId"
          component={() => {
            const p = useParams<{ documentId: string }>();
            return <Navigate href={`/documents/${p.documentId}`} />;
          }}
        />
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
          path="/admin/statistics"
          component={() => (
            <AdminRoute>
              <StatsDashboard />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/ppt-templates"
          component={() => <Navigate href="/admin/internal/ppt-templates" />}
        />
        <Route
          path="/admin/ppt-templates/:id/profile"
          component={() => {
            const p = useParams<{ id: string }>();
            return <Navigate href={`/admin/internal/ppt-templates/${p.id}/profile`} />;
          }}
        />
        <Route
          path="/admin/internal/ppt-templates"
          component={() => (
            <AdminRoute>
              <PptTemplateManagement />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/internal/ppt-templates/:id/profile"
          component={() => (
            <AdminRoute>
              <PptTemplateProfileEditor />
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
