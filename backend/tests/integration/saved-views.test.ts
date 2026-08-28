import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { savedViews } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";
import type { Db } from "../../src/db/client.js";

const GHOST = "00000000-0000-4000-8000-000000000000";

let app: Express;
let db: Db;
let ownerCookie: string;
let wsId: string;
let projectId: string;
let labelId: string;

async function signup(email: string) {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password123", name: "Test User" })
    .expect(201);
  return res.headers["set-cookie"][0].split(";")[0];
}

async function createWorkspace(cookie: string, name: string) {
  const res = await request(app).post("/api/workspaces").set("Cookie", cookie).send({ name }).expect(201);
  return res.body.workspace.id;
}

async function createProject(cookie: string, workspaceId: string, name: string) {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set("Cookie", cookie)
    .send({ name })
    .expect(201);
  return res.body.project.id;
}

async function createLabel(cookie: string, workspaceId: string, name: string) {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceId}/labels`)
    .set("Cookie", cookie)
    .send({ name, color: "violet" })
    .expect(201);
  return res.body.label.id;
}

function validFilters(project: string = projectId, extra: Record<string, unknown> = {}) {
  return { version: 1, projectId: project, ...extra };
}

async function createView(cookie: string, workspaceId: string, name: string, filters = validFilters()) {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceId}/views`)
    .set("Cookie", cookie)
    .send({ name, filters })
    .expect(201);
  return res.body.view;
}

beforeAll(async () => {
  const created = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
    enableRateLimit: false,
  });
  app = created.app;
  db = created.db;

  ownerCookie = await signup("views-owner@example.com");
  wsId = await createWorkspace(ownerCookie, "Views Workspace");
  projectId = await createProject(ownerCookie, wsId, "Website");
  labelId = await createLabel(ownerCookie, wsId, "bug");
});