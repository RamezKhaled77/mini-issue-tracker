import { eq } from "drizzle-orm";
import argon2 from "argon2";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { createSessionRecord, createUserRecord } from "../domain/user.js";
import { resolveDisplayName } from "../lib/identity.js";
import { newSessionId } from "../api/middleware/session.js";
import { ApiError } from "../api/middleware/error-handler.js";

export interface AuthServiceDeps {
  db: Db;
  sessionTtlMs: number;
}

export interface AuthResult {
  user: { id: string; email: string; name: string };
  sessionId: string;
  expiresAt: Date;
}

export function createAuthService(deps: AuthServiceDeps) {
  async function signup(email: string, name: string, password: string): Promise<AuthResult> {
    const existing = deps.db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
    if (existing) {
      throw new ApiError(409, "CONFLICT", "An account with this email already exists");
    }
    const passwordHash = await argon2.hash(password);
    const user = createUserRecord(email, passwordHash, name);
    deps.db.insert(users).values(user).run();
    return await createSession(user.id);
  }

  async function signin(email: string, password: string): Promise<AuthResult> {
    const user = deps.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
    }
    return await createSession(user.id);
  }

  async function createSession(userId: string): Promise<AuthResult> {
    const sessionId = newSessionId();
    const session = createSessionRecord(userId, sessionId, deps.sessionTtlMs);
    deps.db.insert(sessions).values(session).run();
    const user = deps.db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).get();
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
    return {
      user: { id: user.id, email: user.email, name: resolveDisplayName(user.name, user.email) },
      sessionId,
      expiresAt: session.expiresAt,
    };
  }

  function signout(sessionId: string): void {
    deps.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  async function rotateSession(userId: string, sessionId: string): Promise<AuthResult> {
    deps.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return await createSession(userId);
  }

  return { signup, signin, signout, createSession, rotateSession };
}

export type AuthService = ReturnType<typeof createAuthService>;