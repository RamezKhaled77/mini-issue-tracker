import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { sessions, users } from "../../db/schema.js";
import { resolveDisplayName } from "../../lib/identity.js";

const SESSION_COOKIE = "session_id";
const SESSION_ID_LENGTH = 32;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      sessionUserId?: string;
      user?: SessionUser;
    }
  }
}

export interface SessionDeps {
  db: Db;
  secret: string;
  sessionTtlMs: number;
  production: boolean;
}

export function createSessionMiddleware(deps: SessionDeps) {
  function sign(value: string): string {
    return createHmac("sha256", deps.secret).update(value).digest("hex");
  }

  function deserialize(raw: string): string | null {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return null;
    const expected = sign(payload);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return Buffer.from(payload, "base64url").toString("utf8");
  }

  async function attachUser(req: Request) {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) return;
    const sessionId = deserialize(raw);
    if (!sessionId) return;
    const row = deps.db
      .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();
    if (!row || row.expiresAt.getTime() < Date.now()) return;
    const user = deps.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, row.userId))
      .get();
    if (!user) return;
    req.sessionId = sessionId;
    req.sessionUserId = user.id;
    req.user = { id: user.id, email: user.email, name: resolveDisplayName(user.name, user.email) };
  }

  return async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
    await attachUser(req);
    next();
  };
}

export function serializeSessionId(sessionId: string, secret: string): string {
  const payload = Buffer.from(sessionId, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function sessionCookieOptions(production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function newSessionId(): string {
  return randomBytes(SESSION_ID_LENGTH).toString("hex");
}
