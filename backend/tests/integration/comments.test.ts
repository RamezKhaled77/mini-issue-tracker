import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject } from "../helpers.js";
import { createApp } from "../../src/app.js";
import { memberships, users, workspaces } from "../../src/db/schema.js";
import { createUserRecord } from "../../src/domain/user.js";

let app: Express;
let cookie: string;
let wsId: string;
let projectId: string;
let issueId: string;
let authorId: string;

beforeAll(async () => {
  app = setupApp();
  cookie = await signupAs("alice@example.com");
  authorId = (await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200)).body.user.id;
  wsId = await createWorkspace(cookie, "Team Alpha");
  projectId = await createProject(cookie, wsId, "Website");
  const res = await request(app)
    .post(`/api/projects/${projectId}/issues`)
    .set("Cookie", cookie)
    .send({ title: "Bug", status: "Open", priority: "Medium" })
    .expect(201);
  issueId = res.body.issue.id;
});

describe("comments", () => {
  it("adds a comment", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .send({ body: "Reproduced locally" })
      .expect(201);
    expect(res.body.comment.body).toBe("Reproduced locally");
    expect(res.body.comment.authorId).toBe(authorId);
    expect(res.body.comment.author).toEqual({ id: authorId, name: "Test User" });
    expect(res.body.comment).not.toHaveProperty("passwordHash");
  });

  it("rejects a blank comment", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .send({ body: " " })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("lists comments for an issue in order", async () => {
    await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .send({ body: "Second comment" })
      .expect(201);
    const res = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].body).toBe("Reproduced locally");
    for (const item of res.body.items) {
      expect(item.authorId).toBe(authorId);
      expect(item.author).toEqual({ id: authorId, name: "Test User" });
      expect(item).not.toHaveProperty("passwordHash");
    }
  });

  it("comments persist across re-fetch", async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].author).toEqual({ id: authorId, name: "Test User" });
  });

  it("outsider cannot add comments", async () => {
    const outsider = await signupAs("snoop@example.com");
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", outsider)
      .send({ body: "intruder" })
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("resolves the email local-part for a legacy comment author with null name", async () => {
    const { app: legacyApp, db } = createApp({
      dbPath: ":memory:",
      sessionSecret: "test-secret",
      production: false,
    });
    const passwordHash = await argon2.hash("password123");
    const legacyUser = createUserRecord("legacy-commenter@example.com", passwordHash);
    db.insert(users).values(legacyUser).run();
    db.insert(workspaces)
      .values({
        id: "ws-legacy-comments",
        name: "Legacy Workspace",
        ownerId: legacyUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(memberships)
      .values({ userId: legacyUser.id, workspaceId: "ws-legacy-comments", joinedAt: new Date() })
      .run();

    const signin = await request(legacyApp)
      .post("/api/auth/signin")
      .send({ email: "legacy-commenter@example.com", password: "password123" })
      .expect(200);
    const legacyCookie = signin.headers["set-cookie"][0].split(";")[0];

    const projectRes = await request(legacyApp)
      .post("/api/workspaces/ws-legacy-comments/projects")
      .set("Cookie", legacyCookie)
      .send({ name: "Legacy Project" })
      .expect(201);
    const legacyProjectId = projectRes.body.project.id;

    const issueRes = await request(legacyApp)
      .post(`/api/projects/${legacyProjectId}/issues`)
      .set("Cookie", legacyCookie)
      .send({ title: "Legacy issue", status: "Open", priority: "Medium" })
      .expect(201);
    const legacyIssueId = issueRes.body.issue.id;

    const added = await request(legacyApp)
      .post(`/api/issues/${legacyIssueId}/comments`)
      .set("Cookie", legacyCookie)
      .send({ body: "Legacy comment" })
      .expect(201);
    expect(added.body.comment.authorId).toBe(legacyUser.id);
    expect(added.body.comment.author).toEqual({ id: legacyUser.id, name: "legacy-commenter" });
    expect(added.body.comment).not.toHaveProperty("passwordHash");

    const list = await request(legacyApp)
      .get(`/api/issues/${legacyIssueId}/comments`)
      .set("Cookie", legacyCookie)
      .expect(200);
    expect(list.body.items[0].author).toEqual({ id: legacyUser.id, name: "legacy-commenter" });
  });
});