import type { Express } from "express";
import type { Db } from "../../db/client.js";
import { createAuthService } from "../../services/auth.js";
import { authRoutes } from "./auth.js";
import { workspaceRoutes } from "./workspaces.js";
import { projectRoutes } from "./projects.js";
import { issueRoutes } from "./issues.js";
import { commentRoutes } from "./comments.js";
import { dashboardRoutes } from "./dashboard.js";
import { labelRoutes } from "./labels.js";
import { myIssuesRoutes } from "./myIssues.js";
import { activityRoutes } from "./activities.js";
import { createWorkspaceService } from "../../services/workspace.js";
import { createProjectService } from "../../services/project.js";
import { createIssueService } from "../../services/issue.js";
import { createLabelService } from "../../services/label.js";
import { createCommentService } from "../../services/comment.js";
import { createDashboardService } from "../../services/dashboard.js";
import { createMembershipService } from "../../services/membership.js";
import { createMyIssuesService } from "../../services/myIssues.js";
import { createActivityService } from "../../services/activity.js";

export interface AppDeps {
  db: Db;
  sessionSecret: string;
  production: boolean;
  sessionTtlMs: number;
}

export function registerRoutes(app: Express, deps: AppDeps) {
  const authService = createAuthService({ db: deps.db, sessionTtlMs: deps.sessionTtlMs });
  const membershipService = createMembershipService({ db: deps.db });
  const workspaceService = createWorkspaceService({ db: deps.db, membershipService });
  const projectService = createProjectService({ db: deps.db, membershipService });
  const activityService = createActivityService({ db: deps.db, membershipService, projectService });
  const issueService = createIssueService({ db: deps.db, membershipService, projectService, activityService });
  const labelService = createLabelService({ db: deps.db, membershipService });
  const commentService = createCommentService({ db: deps.db, membershipService, projectService });
  const dashboardService = createDashboardService({ db: deps.db, membershipService });
  const myIssuesService = createMyIssuesService({ db: deps.db, membershipService });

  app.use("/api/auth", authRoutes({ ...deps, authService }));
  app.use("/api", workspaceRoutes({ db: deps.db, workspaceService, membershipService }));
  app.use("/api", projectRoutes({ db: deps.db, projectService, membershipService }));
  app.use("/api", issueRoutes({ db: deps.db, issueService, membershipService }));
  app.use("/api", commentRoutes({ db: deps.db, commentService }));
  app.use("/api", labelRoutes({ db: deps.db, labelService, membershipService }));
  app.use("/api", dashboardRoutes({ db: deps.db, dashboardService }));
  app.use("/api", myIssuesRoutes({ db: deps.db, myIssuesService }));
  app.use("/api", activityRoutes({ db: deps.db, activityService }));
}