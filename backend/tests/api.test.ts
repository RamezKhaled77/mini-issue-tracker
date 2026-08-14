import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { Express } from "express";

let app: Express;

beforeAll(() => {
  const { app: createdApp } = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
  });
  app = createdApp;
});

describe("full flow", () => {
  let cookie: string;

  it("signs up", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "alice@example.com", password: "password123" })
      .expect(201);
    expect(res.body.user.email).toBe("alice@example.com");
    cookie = res.headers["set-cookie"][0].split(";")[0];
  });

  it("gets current user", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(res.body.user.email).toBe("alice@example.com");
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
      .send({ name: "bug" })
      .expect(201);
    const labelId = labelRes.body.label.id;

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