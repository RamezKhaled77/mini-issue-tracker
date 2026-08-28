import { z } from "zod";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  SAVED_VIEW_FILTERS_VERSION,
  VIEW_NAME_MAX_LENGTH,
} from "@mini-issue-tracker/shared";

export const savedViewFiltersSchema = z
  .object({
    version: z.literal(SAVED_VIEW_FILTERS_VERSION),
    projectId: z.string().uuid("Invalid project"),
    search: z.string().trim().max(200).optional(),
    status: z.enum(ISSUE_STATUSES).optional(),
    priority: z.enum(ISSUE_PRIORITIES).optional(),
    labelId: z.string().uuid("Invalid label").optional(),
  })
  .strict();

export const createSavedViewSchema = z.object({
  name: z.string().trim().min(1, "View name is required").max(VIEW_NAME_MAX_LENGTH),
  filters: savedViewFiltersSchema,
});

export const updateSavedViewSchema = z
  .object({
    name: z.string().trim().min(1, "View name is required").max(VIEW_NAME_MAX_LENGTH).optional(),
    filters: savedViewFiltersSchema.optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.filters !== undefined, {
    message: "Provide a name or filters",
  });

export type SavedViewFiltersInput = z.infer<typeof savedViewFiltersSchema>;
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;