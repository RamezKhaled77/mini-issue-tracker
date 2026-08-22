import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { createIssueSchema, issueQuerySchema, updateIssueSchema } from "../validators/issue.js";
import { bulkIssueSchema } from "../validators/bulk.js";
import type { MembershipService } from "../../services/membership.js";
import type { IssueService } from "../../services/issue.js";

export interface IssueRouteDeps {
  db: Db;
  issueService: IssueService;
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

export function issueRoutes(deps: IssueRouteDeps): Router {
  const router = Router();
  const { issueService } = deps;

  router.post("/projects/:projectId/issues", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid issue input", validationFields(parsed.error));
    }
    res.status(201).json({
      issue: issueService.createIssue(req.params.projectId, parsed.data, userId),
    });
  });

  router.get("/projects/:projectId/issues", (req, res) => {
    const userId = requireAuth(req);
    const parsed = issueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid query", validationFields(parsed.error));
    }
    res.status(200).json(issueService.listIssues(req.params.projectId, userId, parsed.data));
  });

  router.get("/issues/:id", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ issue: issueService.getIssue(req.params.id, userId) });
  });

  router.patch("/issues/:id", (req, res) => {
    const userId = requireAuth(req);
    const parsed = updateIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid issue input", validationFields(parsed.error));
    }
    res.status(200).json({ issue: issueService.updateIssue(req.params.id, parsed.data, userId) });
  });

  router.post("/issues/bulk", (req, res) => {
    const userId = requireAuth(req);
    const parsed = bulkIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION", "Invalid bulk issue input", validationFields(parsed.error));
    }
    res.status(200).json(issueService.bulkUpdate(parsed.data, userId));
  });

  router.delete("/issues/:id", (req, res) => {
    const userId = requireAuth(req);
    issueService.deleteIssue(req.params.id, userId);
    res.status(204).end();
  });

  return router;
}