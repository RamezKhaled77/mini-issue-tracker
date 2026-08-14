import { randomUUID } from "node:crypto";

export interface CommentEntity {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export function createCommentRecord(issueId: string, authorId: string, body: string): CommentEntity {
  return { id: randomUUID(), issueId, authorId, body, createdAt: new Date() };
}