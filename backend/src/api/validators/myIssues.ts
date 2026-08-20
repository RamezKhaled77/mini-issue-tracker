import { z } from "zod";

export const myIssuesQuerySchema = z.object({
  includeClosed: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export type MyIssuesQueryInput = z.infer<typeof myIssuesQuerySchema>;