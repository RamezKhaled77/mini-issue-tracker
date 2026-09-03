import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import type { DashboardService } from "../../services/dashboard.js";

export interface DashboardRouteDeps {
  db: Db;
  dashboardService: DashboardService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function dashboardRoutes(deps: DashboardRouteDeps): Router {
  const router = Router();

  router.get("/workspaces/:id/dashboard", (req, res) => {
    if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
    res.status(200).json(deps.dashboardService.getStats(req.params.id, req.user.id));
  });

  router.get("/workspaces/:id/overview", (req, res) => {
    if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
    res
      .status(200)
      .json(deps.dashboardService.getWorkspaceDashboard(req.params.id, req.user.id));
  });

  return router;
}
