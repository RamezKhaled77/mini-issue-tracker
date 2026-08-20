import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { createApp } from "../src/app.js";
import { users } from "../src/db/schema.js";
import { createUserRecord } from "../src/domain/user.js";
import type { Express } from "express";
import type { Db } from "../src/db/client.js";

let app: Express;
let db: Db;

beforeAll(() => {
  const { app: createdApp, db: createdDb } = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
  });
  app = createdApp;
  db = createdDb;
});

describe("full flow", () => {
  let cookie: string;

  it("signs up", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Alice Smith", email: "alice@example.com", password: "password123" })
      .expect(201);
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.name).toBe("Alice Smith");
    cookie = res.headers["set-cookie"][0].split(";")[0];
  });

  it("gets current user", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.name).toBe("Alice Smith");
  });

  it("creates a workspace", async () => {
    const res = await request(app)
      .post("/api/workspaces")
      .set("Cookie", cookie)
      .send({ name: "Team Alpha" })
      .expect(201);
    expect(res.body.workspace.name).toBe("Team Alpha");
  });

  it("creates a project", async () => {
    const ws = await request(app).get("/api/workspaces").set("Cookie", cookie).expect(200);
    const wsId = ws.body.items[0].id;
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", cookie)
      .send({ name: "Website" })
      .expect(201);
    expect(res.body.project.name).toBe("Website");
  });

  it("creates an issue with labels, filters, and comments", async () => {
    const ws = await request(app).get("/api/workspaces").set("Cookie", cookie).expect(200);
    const wsId = ws.body.items[0].id;
    const proj = await request(app).get(`/api/workspaces/${wsId}/projects`).set("Cookie", cookie).expect(200);
    const projectId = proj.body.items[0].id;

    const labelRes = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", cookie)
      .send({ name: "bug", color: "violet" })
      .expect(201);
    const labelId = labelRes.body.label.id;
    expect(labelRes.body.label.color).toBe("violet");

    const issueRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({
        title: "Fix login bug",
        description: "The login button does nothing",
        status: "Open",
        priority: "High",
        labelIds: [labelId],
      })
      .expect(201);
    expect(issueRes.body.issue.title).toBe("Fix login bug");
    expect(issueRes.body.issue.labelIds).toContain(labelId);
    expect(issueRes.body.issue.labels).toContainEqual(
      expect.objectContaining({ id: labelId, name: "bug", color: "violet" })
    );
    const issueId = issueRes.body.issue.id;

    const listRes = await request(app)
      .get(`/api/projects/${projectId}/issues?search=login&priority=High`)
      .set("Cookie", cookie)
      .expect(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.items[0].id).toBe(issueId);

    await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .send({ body: "Reproduced" })
      .expect(201);

    const comments = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .expect(200);
    expect(comments.body.items).toHaveLength(1);
    expect(comments.body.items[0].body).toBe("Reproduced");
  });

  it("updates and deletes the issue", async () => {
    const ws = await request(app).get("/api/workspaces").set("Cookie", cookie).expect(200);
    const wsId = ws.body.items[0].id;
    const proj = await request(app).get(`/api/workspaces/${wsId}/projects`).set("Cookie", cookie).expect(200);
    const projectId = proj.body.items[0].id;
    const issues = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .expect(200);
    const issueId = issues.body.items[0].id;

    const patch = await request(app)
      .patch(`/api/issues/${issueId}`)
      .set("Cookie", cookie)
      .send({ status: "In Progress" })
      .expect(200);
    expect(patch.body.issue.status).toBe("In Progress");

    await request(app).delete(`/api/issues/${issueId}`).set("Cookie", cookie).expect(204);
  });

  it("rejects unauthorized access", async () => {
    const res = await request(app).get("/api/workspaces").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("signs out", async () => {
    await request(app).post("/api/auth/signout").set("Cookie", cookie).expect(204);
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("signup name validation (US1)", () => {
  it("rejects signup without a name", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "noname@example.com", password: "password123" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.fields.name).toBe("Full name is required");
  });

  it("rejects signup with a blank name", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "   ", email: "blankname@example.com", password: "password123" })
      .expect(422);
    expect(res.body.error.fields.name).toBe("Full name is required");
  });

  it("rejects signup with an over-long name", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "x".repeat(101), email: "longname@example.com", password: "password123" })
      .expect(422);
    expect(res.body.error.fields.name).toBeDefined();
  });
});

describe("auth security (US1)", () => {
  let cookie: string;

  it("never exposes passwordHash in auth responses", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Bob Builder", email: "bob@example.com", password: "password123" })
      .expect(201);
    expect(signup.body.user).not.toHaveProperty("passwordHash");
    expect(signup.body.user).not.toHaveProperty("password_hash");
    expect(JSON.stringify(signup.body)).not.toContain("passwordHash");
    expect(JSON.stringify(signup.body)).not.toContain("$argon2");

    cookie = signup.headers["set-cookie"][0].split(";")[0];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(me.body)).not.toContain("$argon2");

    const signin = await request(app)
      .post("/api/auth/signin")
      .send({ email: "bob@example.com", password: "password123" })
      .expect(200);
    expect(signin.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(signin.body)).not.toContain("$argon2");
  });
});

describe("legacy user fallback (US1)", () => {
  it("resolves the email local-part for a legacy user with null name", async () => {
    const passwordHash = await argon2.hash("password123");
    db.insert(users)
      .values(createUserRecord("legacy@example.com", passwordHash))
      .run();

    const signin = await request(app)
      .post("/api/auth/signin")
      .send({ email: "legacy@example.com", password: "password123" })
      .expect(200);
    expect(signin.body.user.name).toBe("legacy");
    const cookie = signin.headers["set-cookie"][0].split(";")[0];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.user.name).toBe("legacy");
  });
});