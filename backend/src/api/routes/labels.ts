import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import type { MembershipService } from "../../services/membership.js";
import type { LabelService } from "../../services/label.js";
import { createLabelSchema, updateLabelSchema } from "../validators/label.js";

export interface LabelRouteDeps {
  db: Db;
  labelService: LabelService;
  membershipService: MembershipService;
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

export function labelRoutes(deps: LabelRouteDeps): Router {
  const router = Router();
  const { labelService } = deps;

  router.post("/workspaces/:workspaceId/labels", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid label input", validationFields(parsed.error));
    }
    res.status(201).json({
      label: labelService.createLabel(req.params.workspaceId, parsed.data, userId),
    });
  });

  router.get("/workspaces/:workspaceId/labels", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ items: labelService.listLabels(req.params.workspaceId, userId) });
  });

  router.patch("/labels/:id", (req, res) => {
    const userId = requireAuth(req);
    const parsed = updateLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid label input", validationFields(parsed.error));
    }
    res.status(200).json({ label: labelService.updateLabel(req.params.id, parsed.data, userId) });
  });

  router.delete("/labels/:id", (req, res) => {
    const userId = requireAuth(req);
    labelService.deleteLabel(req.params.id, userId);
    res.status(204).end();
  });

  return router;
}