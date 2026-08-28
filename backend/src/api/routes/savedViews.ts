import { Router } from "express";
import { ApiError } from "../middleware/error-handler.js";
import type { MembershipService } from "../../services/membership.js";
import type { SavedViewService } from "../../services/savedView.js";
import { createSavedViewSchema, updateSavedViewSchema } from "../validators/savedView.js";

export interface SavedViewRouteDeps {
  savedViewService: SavedViewService;
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

export function savedViewRoutes(deps: SavedViewRouteDeps): Router {
  const router = Router();
  const { savedViewService } = deps;

  router.post("/workspaces/:workspaceId/views", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createSavedViewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid saved view input", validationFields(parsed.error));
    }
    res.status(201).json({ view: savedViewService.createSavedView(req.params.workspaceId, parsed.data, userId) });
  });

  router.get("/workspaces/:workspaceId/views", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ items: savedViewService.listSavedViews(req.params.workspaceId, userId) });
  });

  router.patch("/views/:id", (req, res) => {
    const userId = requireAuth(req);
    const parsed = updateSavedViewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid saved view input", validationFields(parsed.error));
    }
    res.status(200).json({ view: savedViewService.updateSavedView(req.params.id, parsed.data, userId) });
  });

  router.delete("/views/:id", (req, res) => {
    const userId = requireAuth(req);
    savedViewService.deleteSavedView(req.params.id, userId);
    res.status(204).end();
  });

  return router;
}