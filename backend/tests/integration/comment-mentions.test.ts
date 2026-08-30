import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";

describe("comment mentions (integration)", () => {
  let app: Express;
  let aliceCookie: string;
  let bobCookie: string;
  let aliceId: string;
  let bobId: string;
  let wsId: string;
  let issueId: string;

  beforeAll(async () => {
    const { app: createdApp } = createApp({ dbPath: ":memory:", sessionSecret: "test-secret", production: false, enableRateLimit: false });
    app = createdApp;

    const aliceRes = await request(app).post("/api/auth/signup").send({ email: "alice@test.com", password: "password123", name: "Alice" }).expect(201);
    aliceCookie = aliceRes.headers["set-cookie"][0].split(";")[0];
    aliceId = aliceRes.body.user.id;

    const bobRes = await request(app).post("/api/auth/signup").send({ email: "bob@test.com", password: "password123", name: "Bob" }).expect(201);
    bobCookie = bobRes.headers["set-cookie"][0].split(";")[0];
    bobId = bobRes.body.user.id;

    const wsRes = await request(app).post("/api/workspaces").set("Cookie", aliceCookie).send({ name: "Team Alpha" }).expect(201);
    wsId = wsRes.body.workspace.id;

    const projectRes = await request(app).post(`/api/workspaces/${wsId}/projects`).set("Cookie", aliceCookie).send({ name: "Website" }).expect(201);
    const projectId = projectRes.body.project.id;

    const issueRes = await request(app).post(`/api/projects/${projectId}/issues`).set("Cookie", aliceCookie).send({ title: "Bug", status: "Open", priority: "Medium" }).expect(201);
    issueId = issueRes.body.issue.id;

    const inviteRes = await request(app).post(`/api/workspaces/${wsId}/invitations`).set("Cookie", aliceCookie).expect(201);
    const token = inviteRes.body.invitation.token;

    await request(app).post("/api/workspaces/join").set("Cookie", bobCookie).send({ token }).expect(200);
  });

  it("adds a comment with a mention and returns enriched mentions", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .send({ body: "Hey @Bob check this", mentions: [bobId] })
      .expect(201);
    expect(res.body.comment.body).toBe("Hey @Bob check this");
    expect(res.body.comment.mentions).toHaveLength(1);
    expect(res.body.comment.mentions[0].userId).toBe(bobId);
    expect(res.body.comment.mentions[0].name).toBe("Bob");
  });

  it("lists comments with mentions enriched", async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].mentions).toHaveLength(1);
    expect(res.body.items[0].mentions[0].userId).toBe(bobId);
  });

  it("rejects a mention of a non-member with 422", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .send({ body: "Hey @stranger", mentions: ["00000000-0000-0000-0000-000000000000"] })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("rejects a self-mention with 422", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .send({ body: "Hey @me", mentions: [aliceId] })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("persists mentions across re-fetch", async () => {
    await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .send({ body: "Second comment", mentions: [bobId] })
      .expect(201);
    const res = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].mentions).toHaveLength(1);
    expect(res.body.items[1].mentions).toHaveLength(1);
  });

  it("does not include mentions when comments have none", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", aliceCookie)
      .send({ body: "No mentions here" })
      .expect(201);
    expect(res.body.comment.mentions).toEqual([]);
  });
});