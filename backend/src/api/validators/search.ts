import { z } from "zod";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LENGTH, SEARCH_MAX_LIMIT } from "@mini-issue-tracker/shared";

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search query must be at least 2 characters")
    .max(SEARCH_MAX_LENGTH, `Search query must be at most ${SEARCH_MAX_LENGTH} characters`),
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
