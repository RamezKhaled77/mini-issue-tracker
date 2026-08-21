import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { activityQuerySchema } from "../validators/activity.js";
import type { ActivityService } from "../../services/activity.js";

export interface ActivityRouteDeps {
  db: Db;
  activityService: ActivityService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

function validationFields(error: { issues: { path: (string | number)[]; message: string }[] }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] = issue.message;
  return fields;
}

export function activityRoutes(deps: ActivityRouteDeps): Router {
  const router = Router();
  const { activityService } = deps;

  router.get("/issues/:id/activity", (req, res) => {
    const userId = requireAuth(req);
    const parsed = activityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid query", validationFields(parsed.error));
    }
    const { items, total } = activityService.listActivities(req.params.id, userId, parsed.data);
    res.status(200).json({ items, page: parsed.data.page, pageSize: parsed.data.pageSize, total });
  });

  return router;
}