import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.js";
import type { MembershipService } from "../../services/membership.js";
import type { ProjectService } from "../../services/project.js";

export interface ProjectRouteDeps {
  db: Db;
  projectService: ProjectService;
  membershipService: MembershipService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function projectRoutes(deps: ProjectRouteDeps): Router {
  const router = Router();
  const { projectService } = deps;

  router.post("/workspaces/:workspaceId/projects", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid project input", fields);
    }
    res.status(201).json({
      project: projectService.createProject(req.params.workspaceId, parsed.data.name, userId),
    });
  });

  router.get("/workspaces/:workspaceId/projects", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ items: projectService.listProjects(req.params.workspaceId, userId) });
  });

  router.patch("/projects/:id", (req, res) => {
    const userId = requireAuth(req);
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid project input", fields);
    }
    res.status(200).json({ project: projectService.renameProject(req.params.id, parsed.data.name, userId) });
  });

  router.delete("/projects/:id", (req, res) => {
    const userId = requireAuth(req);
    projectService.deleteProject(req.params.id, userId);
    res.status(204).end();
  });

  return router;
}