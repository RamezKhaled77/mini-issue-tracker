import { z } from "zod";
import { LABEL_COLORS } from "@mini-issue-tracker/shared";

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, "Label name is required").max(50),
  color: z.enum(LABEL_COLORS),
});

export const updateLabelSchema = createLabelSchema.partial().refine(
  (v) => v.name !== undefined || v.color !== undefined,
  { message: "Provide a name or color" }
);

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;