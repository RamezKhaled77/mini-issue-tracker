import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";

let app: Express;

beforeAll(() => {
  const created = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
    enableRateLimit: true,
  });
  app = created.app;
});

describe("security hardening", () => {
  it("rate limits sign-in attempts", async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 8; i += 1) {
      last = await request(app)
        .post("/api/auth/signin")
        .send({ email: "nobody@example.com", password: "wrong" });
    }
    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe("RATE_LIMITED");
  });

  it("rate limits sign-up attempts", async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 8; i += 1) {
      last = await request(app)
        .post("/api/auth/signup")
        .send({ email: `r${i}@example.com`, password: "password123" });
    }
    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe("RATE_LIMITED");
  });

  it("returns a uniform error shape", async () => {
    const res = await request(app).get("/api/workspaces").expect(401);
    expect(res.body.error).toEqual({
      code: "UNAUTHORIZED",
      message: expect.any(String),
    });
  });
});