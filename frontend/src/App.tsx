import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/auth.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { WorkspacePage } from "./pages/WorkspacePage.js";
import { WorkspaceDashboardPage } from "./pages/WorkspaceDashboardPage.js";
import { IssuePage } from "./pages/IssuePage.js";
import { MyIssuesPage } from "./pages/MyIssuesPage.js";
import { LabelsPage } from "./pages/LabelsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { Layout } from "./components/Layout.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { SkeletonRows } from "./components/Skeleton.js";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonRows rows={4} className="page-skeleton" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="my-issues" element={<MyIssuesPage />} />
          <Route path="workspaces/:workspaceId" element={<WorkspacePage />} />
          <Route path="workspaces/:workspaceId/dashboard" element={<WorkspaceDashboardPage />} />
          <Route path="workspaces/:workspaceId/labels" element={<LabelsPage />} />
          <Route path="workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}