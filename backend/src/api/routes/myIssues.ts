import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { myIssuesQuerySchema } from "../validators/myIssues.js";
import type { MyIssuesService } from "../../services/myIssues.js";

export interface MyIssuesRouteDeps {
  db: Db;
  myIssuesService: MyIssuesService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function myIssuesRoutes(deps: MyIssuesRouteDeps): Router {
  const router = Router();

  router.get("/my-issues", (req, res) => {
    const userId = requireAuth(req);
    const parsed = myIssuesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid query", fields);
    }
    res.status(200).json(deps.myIssuesService.getMyIssues(userId, parsed.data));
  });

  return router;
}