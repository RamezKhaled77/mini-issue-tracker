import { Router } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { searchQuerySchema } from "../validators/search.js";
import type { SearchService } from "../../services/search.js";

export interface SearchRouteDeps {
  db: Db;
  searchService: SearchService;
}

function requireAuth(req: { user?: { id: string } }) {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  return req.user.id;
}

export function searchRoutes(deps: SearchRouteDeps): Router {
  const router = Router();

  router.get("/search", (req, res) => {
    const userId = requireAuth(req);
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid query", fields);
    }
    res
      .status(200)
      .json(deps.searchService.search(userId, parsed.data.q, parsed.data.limit));
  });

  return router;
}
