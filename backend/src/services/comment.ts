import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { comments, users } from "../db/schema.js";
import { createCommentRecord } from "../domain/comment.js";
import { resolveDisplayName } from "../lib/identity.js";
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
    const author = deps.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, authorId))
      .get();
    return {
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      author: { id: comment.authorId, name: resolveDisplayName(author?.name ?? null, author?.email ?? "") },
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
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.issueId, issueId))
      .orderBy(comments.createdAt)
      .all()
      .map((c) => ({
        id: c.id,
        issueId: c.issueId,
        authorId: c.authorId,
        author: { id: c.authorId, name: resolveDisplayName(c.authorName, c.authorEmail ?? "") },
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      }));
  }

  return { addComment, listComments };
}

export type CommentService = ReturnType<typeof createCommentService>;