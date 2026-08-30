import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { comments, commentMentions, memberships, users } from "../db/schema.js";
import { createCommentRecord } from "../domain/comment.js";
import { resolveDisplayName } from "../lib/identity.js";
import { ApiError } from "../api/middleware/error-handler.js";
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

  function validateMentions(workspaceId: string, mentionIds: string[], authorId: string) {
    const uniqueIds = [...new Set(mentionIds)];
    if (uniqueIds.length === 0) return;

    const memberRows = deps.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), inArray(memberships.userId, uniqueIds)))
      .all();
    const validMemberIds = new Set(memberRows.map((r) => r.userId));

    const invalidIds = uniqueIds.filter((id) => !validMemberIds.has(id));
    if (invalidIds.length > 0) {
      throw new ApiError(422, "VALIDATION", "One or more mentions are invalid", {
        mentions: "One or more mentions are invalid",
      });
    }

    const selfMention = uniqueIds.find((id) => id === authorId);
    if (selfMention) {
      throw new ApiError(422, "VALIDATION", "Cannot mention yourself", {
        mentions: "Cannot mention yourself",
      });
    }
  }

  function addComment(issueId: string, authorId: string, body: string, mentionIds?: string[]) {
    const workspaceId = requireIssueAccess(authorId, issueId);
    const validatedMentionIds = mentionIds ?? [];
    validateMentions(workspaceId, validatedMentionIds, authorId);

    const comment = createCommentRecord(issueId, authorId, body);

    return deps.db.transaction(() => {
      deps.db.insert(comments).values(comment).run();

      const mentionRecords = validatedMentionIds.map((userId) => ({
        id: randomUUID(),
        commentId: comment.id,
        mentionedUserId: userId,
        createdAt: new Date(),
      }));
      if (mentionRecords.length > 0) {
        deps.db.insert(commentMentions).values(mentionRecords).run();
      }

      const author = deps.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, authorId))
        .get();

      const mentions = validatedMentionIds.map((userId) => ({
        userId,
        name: resolveDisplayName(
          deps.db.select({ name: users.name }).from(users).where(eq(users.id, userId)).get()?.name ?? null,
          deps.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).get()?.email ?? ""
        ),
      }));

      return {
        id: comment.id,
        issueId: comment.issueId,
        authorId: comment.authorId,
        author: { id: comment.authorId, name: resolveDisplayName(author?.name ?? null, author?.email ?? "") },
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        mentions,
      };
    });
  }

  function listComments(issueId: string, userId: string) {
    requireIssueAccess(userId, issueId);

    const commentRows = deps.db
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
      .all();

    const commentIds = commentRows.map((c) => c.id);
    const mentionRows = commentIds.length > 0
      ? deps.db
          .select({
            commentId: commentMentions.commentId,
            mentionedUserId: commentMentions.mentionedUserId,
            mentionedName: users.name,
            mentionedEmail: users.email,
          })
          .from(commentMentions)
          .innerJoin(users, eq(commentMentions.mentionedUserId, users.id))
          .where(inArray(commentMentions.commentId, commentIds))
          .all()
      : [];

    const mentionsByComment = new Map<string, Array<{ userId: string; name: string }>>();
    for (const row of mentionRows) {
      const existing = mentionsByComment.get(row.commentId) ?? [];
      existing.push({ userId: row.mentionedUserId, name: resolveDisplayName(row.mentionedName, row.mentionedEmail ?? "") });
      mentionsByComment.set(row.commentId, existing);
    }

    return commentRows.map((c) => ({
      id: c.id,
      issueId: c.issueId,
      authorId: c.authorId,
      author: { id: c.authorId, name: resolveDisplayName(c.authorName, c.authorEmail ?? "") },
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      mentions: mentionsByComment.get(c.id) ?? [],
    }));
  }

  return { addComment, listComments };
}

export type CommentService = ReturnType<typeof createCommentService>;
