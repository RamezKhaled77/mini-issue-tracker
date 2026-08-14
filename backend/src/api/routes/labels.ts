import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import type { MembershipService } from "../../services/membership.js";
import type { IssueService } from "../../services/issue.js";
import { z } from "zod";

export interface LabelRouteDeps {
  db: Db;
  issueService: IssueService;
  membershipService: MembershipService;
}

const createLabelSchema = z.object({
  name: z.string().trim().min(1, "Label name is required").max(50),
});

export function labelRoutes(deps: LabelRouteDeps): Router {
  const router = Router();

  router.post("/workspaces/:workspaceId/labels", (req, res) => {
    if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid label input", fields);
    }
    res.status(201).json({
      label: deps.issueService.createLabel(req.params.workspaceId, parsed.data.name, req.user.id),
    });
  });

  router.get("/workspaces/:workspaceId/labels", (req, res) => {
    if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
    res.status(200).json({ items: deps.issueService.listLabels(req.params.workspaceId, req.user.id) });
  });

  return router;
}