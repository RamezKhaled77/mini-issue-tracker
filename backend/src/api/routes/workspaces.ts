import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { createWorkspaceSchema, joinWorkspaceSchema, removeMemberSchema } from "../validators/workspace.js";
import type { MembershipService } from "../../services/membership.js";
import type { WorkspaceService } from "../../services/workspace.js";

export interface WorkspaceRouteDeps {
  db: Db;
  workspaceService: WorkspaceService;
  membershipService: MembershipService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function workspaceRoutes(deps: WorkspaceRouteDeps): Router {
  const router = Router();
  const { workspaceService } = deps;

  router.post("/workspaces", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid workspace input", fields);
    }
    res.status(201).json({ workspace: workspaceService.createWorkspace(parsed.data.name, userId) });
  });

  router.get("/workspaces", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ items: workspaceService.listWorkspaces(userId) });
  });

  router.get("/workspaces/:id", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ workspace: workspaceService.getWorkspace(req.params.id, userId) });
  });

  router.post("/workspaces/:id/invitations", (req, res) => {
    const userId = requireAuth(req);
    res.status(201).json({ invitation: workspaceService.createInvitation(req.params.id, userId) });
  });

  router.post("/workspaces/join", (req, res) => {
    const userId = requireAuth(req);
    const parsed = joinWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid join input", fields);
    }
    res.status(200).json({ workspace: workspaceService.joinWorkspace(parsed.data.token, userId) });
  });

  router.get("/workspaces/:id/members", (req, res) => {
    const userId = requireAuth(req);
    deps.membershipService.requireMember(userId, req.params.id);
    res.status(200).json({ items: deps.membershipService.listMembers(req.params.id) });
  });

  router.delete("/workspaces/:id/members/:userId", (req, res) => {
    const ownerId = requireAuth(req);
    const parsed = removeMemberSchema.safeParse({ userId: req.params.userId });
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid member id", {
        userId: parsed.error.issues[0]?.message ?? "Invalid",
      });
    }
    workspaceService.removeMember(req.params.id, ownerId, parsed.data.userId);
    res.status(204).end();
  });

  return router;
}