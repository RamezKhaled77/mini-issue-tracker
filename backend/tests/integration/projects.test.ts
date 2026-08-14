import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject } from "../helpers.js";

let app: Express;
let cookie: string;
let wsId: string;

beforeAll(async () => {
  app = setupApp();
  cookie = await signupAs("alice@example.com");
  wsId = await createWorkspace(cookie, "Team Alpha");
});

describe("project contract", () => {
  it("creates a project", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", cookie)
      .send({ name: "Website" })
      .expect(201);
    expect(res.body.project.name).toBe("Website");
  });

  it("rejects a blank project name", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", cookie)
      .send({ name: " " })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("lists projects in the workspace", async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe("rename and delete", () => {
  it("renames a project", async () => {
    const projectId = await createProject(cookie, wsId, "Mobile App");
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set("Cookie", cookie)
      .send({ name: "Mobile App v2" })
      .expect(200);
    expect(res.body.project.name).toBe("Mobile App v2");
  });

  it("deletes a project", async () => {
    const projectId = await createProject(cookie, wsId, "Temp Project");
    await request(app).delete(`/api/projects/${projectId}`).set("Cookie", cookie).expect(204);
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.some((p: { id: string }) => p.id === projectId)).toBe(false);
  });

  it("outsider cannot list projects", async () => {
    const outsider = await signupAs("bob@example.com");
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});