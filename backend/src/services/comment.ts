import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { comments } from "../db/schema.js";
import { createCommentRecord } from "../domain/comment.js";
import type { ProjectService } from "./project.js";
import type { MembershipService } from "./membership.js";

export interface CommentServiceDeps {
  db: Db;
  projectService: ProjectService;
  membershipService: MembershipService;
}

export function createCommentService(deps: CommentServiceDeps) {
  function requireIssueAccess(userId: string, issueId: string) {
    const workspaceId = deps.projectService.getWorkspaceIdForIssue(issueId);
    deps.membershipService.requireMember(userId, workspaceId);
    return workspaceId;
  }

  function addComment(issueId: string, authorId: string, body: string) {
    requireIssueAccess(authorId, issueId);
    const comment = createCommentRecord(issueId, authorId, body);
    deps.db.insert(comments).values(comment).run();
    return {
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  function listComments(issueId: string, userId: string) {
    requireIssueAccess(userId, issueId);
    return deps.db
      .select({
        id: comments.id,
        issueId: comments.issueId,
        authorId: comments.authorId,
        body: comments.body,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.issueId, issueId))
      .orderBy(comments.createdAt)
      .all()
      .map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  }

  return { addComment, listComments };
}

export type CommentService = ReturnType<typeof createCommentService>;