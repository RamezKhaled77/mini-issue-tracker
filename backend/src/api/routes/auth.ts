import { Router, type Response } from "express";
import type { Db } from "../../db/client.js";
import { ApiError } from "../middleware/error-handler.js";
import { sessionCookieName, sessionCookieOptions, serializeSessionId } from "../middleware/session.js";
import { signinSchema, signupSchema } from "../validators/auth.js";
import type { AuthService } from "../../services/auth.js";

export interface AuthRouteDeps {
  db: Db;
  sessionSecret: string;
  production: boolean;
  sessionTtlMs: number;
  authService: AuthService;
}

export function authRoutes(deps: AuthRouteDeps): Router {
  const router = Router();
  const { authService } = deps;

  function setSessionCookie(res: Response, sessionId: string, expiresAt: Date) {
    res.cookie(sessionCookieName(), serializeSessionId(sessionId, deps.sessionSecret), {
      ...sessionCookieOptions(deps.production),
      expires: expiresAt,
    });
  }

  router.post("/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid sign-up input", fields);
    }
    const { user, sessionId, expiresAt } = await authService.signup(parsed.data.email, parsed.data.name, parsed.data.password);
    setSessionCookie(res, sessionId, expiresAt);
    res.status(201).json({ user });
  });

  router.post("/signin", async (req, res) => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
      throw new ApiError(422, "VALIDATION", "Invalid sign-in input", fields);
    }
    const { user, sessionId, expiresAt } = await authService.signin(parsed.data.email, parsed.data.password);
    setSessionCookie(res, sessionId, expiresAt);
    res.status(200).json({ user });
  });

  router.post("/signout", (req, res) => {
    if (req.sessionId) {
      authService.signout(req.sessionId);
    }
    res.clearCookie(sessionCookieName(), { ...sessionCookieOptions(deps.production), expires: new Date(0) });
    res.status(204).end();
  });

  router.get("/me", (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
    }
    res.status(200).json({ user: req.user });
  });

  return router;
}