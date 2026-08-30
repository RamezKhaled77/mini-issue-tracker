import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment body is required").max(5000),
  mentions: z.array(z.string().uuid()).optional().default([]),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;