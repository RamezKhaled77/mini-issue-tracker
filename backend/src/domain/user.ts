import { randomUUID } from "node:crypto";

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionEntity {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export function createUserRecord(
  email: string,
  passwordHash: string,
  name: string | null = null
): UserEntity {
  const now = new Date();
  return {
    id: randomUUID(),
    email,
    passwordHash,
    name,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSessionRecord(userId: string, sessionId: string, sessionTtlMs: number): SessionEntity {
  const now = new Date();
  return {
    id: sessionId,
    userId,
    expiresAt: new Date(now.getTime() + sessionTtlMs),
    createdAt: now,
  };
}
