import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { createCommentSchema } from "../validators/comment.js";
import type { CommentService } from "../../services/comment.js";

export interface CommentRouteDeps {
  db: Db;
  commentService: CommentService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function commentRoutes(deps: CommentRouteDeps): Router {
  const router = Router();
  const { commentService } = deps;

  router.post("/issues/:issueId/comments", (req, res) => {
    const userId = requireAuth(req);
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid comment input", fields);
    }
    res.status(201).json({
      comment: commentService.addComment(req.params.issueId, userId, parsed.data.body),
    });
  });

  router.get("/issues/:issueId/comments", (req, res) => {
    const userId = requireAuth(req);
    res.status(200).json({ items: commentService.listComments(req.params.issueId, userId) });
  });

  return router;
}