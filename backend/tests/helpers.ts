import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";

let app: Express;

export function setupApp() {
  const created = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
    enableRateLimit: false,
  });
  app = created.app;
  return app;
}

export function getApp(): Express {
  return app;
}

export async function signupAs(email: string, password = "password123"): Promise<string> {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ email, password })
    .expect(201);
  return res.headers["set-cookie"][0].split(";")[0];
}

export async function createWorkspace(cookieValue: string, name: string): Promise<string> {
  const res = await request(app)
    .post("/api/workspaces")
    .set("Cookie", cookieValue)
    .send({ name })
    .expect(201);
  return res.body.workspace.id;
}

export async function createProject(cookieValue: string, workspaceId: string, name: string): Promise<string> {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set("Cookie", cookieValue)
    .send({ name })
    .expect(201);
  return res.body.project.id;
}

export async function joinWorkspace(cookieValue: string, token: string) {
  return request(app).post("/api/workspaces/join").set("Cookie", cookieValue).send({ token });
}