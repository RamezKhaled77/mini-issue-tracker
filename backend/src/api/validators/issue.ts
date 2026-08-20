import { z } from "zod";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";

export const createIssueSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(ISSUE_PRIORITIES),
  assigneeId: z.string().uuid("Invalid assignee").optional().nullable(),
  labelIds: z
    .array(z.string().uuid("Invalid label"))
    .max(50)
    .superRefine((ids, ctx) => {
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", message: "Labels must be unique" });
      }
    })
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .optional()
    .nullable(),
});

export const updateIssueSchema = createIssueSchema.partial();

export const issueQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  assigneeId: z.string().uuid("Invalid assignee").optional(),
  labelId: z.string().uuid("Invalid label").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type IssueQueryInput = z.infer<typeof issueQuerySchema>;