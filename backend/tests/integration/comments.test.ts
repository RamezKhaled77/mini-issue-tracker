import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject } from "../helpers.js";

let app: Express;
let cookie: string;
let wsId: string;
let projectId: string;
let issueId: string;

beforeAll(async () => {
  app = setupApp();
  cookie = await signupAs("alice@example.com");
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
    expect(res.body.comment.authorId).toBeTruthy();
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
  });

  it("comments persist across re-fetch", async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}/comments`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
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
});