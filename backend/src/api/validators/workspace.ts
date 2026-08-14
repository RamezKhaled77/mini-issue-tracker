import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(100),
});

export const joinWorkspaceSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export const removeMemberSchema = z.object({
  userId: z.string().uuid("Invalid user id"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;