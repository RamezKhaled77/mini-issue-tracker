import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { savedViews, users } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";
import type { Db } from "../../src/db/client.js";

const GHOST = "00000000-0000-4000-8000-000000000000";

let app: Express;
let db: Db;
let ownerCookie: string;
let ownerId: string;
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
  const ownerRow = db.select({ id: users.id }).from(users).where(eq(users.email, "views-owner@example.com")).get();
  ownerId = ownerRow!.id;
  wsId = await createWorkspace(ownerCookie, "Views Workspace");
  projectId = await createProject(ownerCookie, wsId, "Website");
    labelId = await createLabel(ownerCookie, wsId, "bug");
});

describe("saved view contract", () => {
  it("creates a view from filters and returns the full shape", async () => {
    const view = await createView(ownerCookie, wsId, "My High Priority", validFilters(projectId, { priority: "High" }));
    expect(view).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        workspaceId: wsId,
        createdById: expect.any(String),
        name: "My High Priority",
        filtersValid: true,
        filters: { version: 1, projectId, priority: "High" },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
  });

  it("creates a view that includes status and label filters", async () => {
    const view = await createView(ownerCookie, wsId, "Open bug", validFilters(projectId, { status: "Open", labelId }));
    expect(view.filters).toEqual({ version: 1, projectId, status: "Open", labelId });
  });

  it("lists views ordered by creation time", async () => {
    await createView(ownerCookie, wsId, "View A", validFilters());
    await createView(ownerCookie, wsId, "View B", validFilters());
    const res = await request(app).get(`/api/workspaces/${wsId}/views`).set("Cookie", ownerCookie).expect(200);
    const idx = (name: string) => res.body.items.findIndex((v: { name: string }) => v.name === name);
    expect(idx("View A")).toBeGreaterThan(-1);
    expect(idx("View B")).toBeGreaterThan(-1);
    expect(idx("View A")).toBeLessThan(idx("View B"));
  });

  it("renames a view", async () => {
    const view = await createView(ownerCookie, wsId, "Rename Me", validFilters());
    const res = await request(app)
      .patch(`/api/views/${view.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "Renamed" })
      .expect(200);
    expect(res.body.view.name).toBe("Renamed");
  });

  it("deletes a view", async () => {
    const view = await createView(ownerCookie, wsId, "Delete Me", validFilters());
    await request(app).delete(`/api/views/${view.id}`).set("Cookie", ownerCookie).expect(204);
    const list = await request(app).get(`/api/workspaces/${wsId}/views`).set("Cookie", ownerCookie).expect(200);
    expect(list.body.items.find((v: { id: string }) => v.id === view.id)).toBeUndefined();
  });

  it("rejects duplicate view names with 409 on create and rename", async () => {
    await createView(ownerCookie, wsId, "Taken", validFilters());
    await createView(ownerCookie, wsId, "Target", validFilters());

    const create = await request(app)
      .post(`/api/workspaces/${wsId}/views`)
      .set("Cookie", ownerCookie)
      .send({ name: "Taken", filters: validFilters() })
      .expect(409);
    expect(create.body.error.code).toBe("CONFLICT");

    const list = await request(app).get(`/api/workspaces/${wsId}/views`).set("Cookie", ownerCookie).expect(200);
    const target = list.body.items.find((v: { name: string }) => v.name === "Target");
    const rename = await request(app)
      .patch(`/api/views/${target.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "Taken" })
      .expect(409);
    expect(rename.body.error.code).toBe("CONFLICT");
  });

  it("rejects blank, whitespace-only, and over-length names", async () => {
    for (const name of ["", "   "]) {
      const res = await request(app)
        .post(`/api/workspaces/${wsId}/views`)
        .set("Cookie", ownerCookie)
        .send({ name, filters: validFilters() })
        .expect(422);
      expect(res.body.error.fields.name).toBe("View name is required");
    }
    const long = await request(app)
      .post(`/api/workspaces/${wsId}/views`)
      .set("Cookie", ownerCookie)
      .send({ name: "x".repeat(61), filters: validFilters() })
      .expect(422);
    expect(long.body.error.fields.name).toBeDefined();
  });

  it("rejects invalid filter configurations", async () => {
    const cases: Record<string, unknown>[] = [
      { status: "Waffle" },
      { version: 2 },
      { projectId: GHOST },
      { labelId: GHOST },
      { assigneeId: GHOST }, // extra key not part of the filter model
    ];
    for (const extra of cases) {
      const res = await request(app)
        .post(`/api/workspaces/${wsId}/views`)
        .set("Cookie", ownerCookie)
        .send({ name: "Bad filters", filters: validFilters(projectId, extra) })
        .expect(422);
      expect(res.body.error.code).toBe("VALIDATION");
    }
  });

  it("returns 403 for a non-member and for owner-without-membership on create", async () => {
    const outsiderCookie = await signup("views-outsider@example.com");
    const list = await request(app)
      .get(`/api/workspaces/${wsId}/views`)
      .set("Cookie", outsiderCookie)
      .expect(403);
    expect(list.body.error.code).toBe("FORBIDDEN");

    const create = await request(app)
      .post(`/api/workspaces/${wsId}/views`)
      .set("Cookie", outsiderCookie)
      .send({ name: "Nope", filters: validFilters() })
      .expect(403);
    expect(create.body.error.code).toBe("FORBIDDEN");

    // ownerCookie owns wsId but is NOT a member of outsider's workspace -> 403
    const outsiderWs = await createWorkspace(outsiderCookie, "Outsider Workspace");
    const outsiderProj = await createProject(outsiderCookie, outsiderWs, "P");
    const put = await request(app)
      .post(`/api/workspaces/${outsiderWs}/views`)
      .set("Cookie", ownerCookie)
      .send({ name: "Hijack", filters: validFilters(outsiderProj) })
      .expect(403);
    expect(put.body.error.code).toBe("FORBIDDEN");
  });

  it("enforces cross-workspace isolation on update and delete", async () => {
    const memberACookie = await signup("views-member-a@example.com");
    const invite = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", ownerCookie)
      .expect(201);
    await request(app)
      .post("/api/workspaces/join")
      .set("Cookie", memberACookie)
      .send({ token: invite.body.invitation.token })
      .expect(200);

    const wsB = await createWorkspace(memberACookie, "Workspace B");
    const projectB = await createProject(memberACookie, wsB, "Project B");
    const viewB = await createView(memberACookie, wsB, "Secret", validFilters(projectB));

    const patch = await request(app)
      .patch(`/api/views/${viewB.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "Hijacked" })
      .expect(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");

    const del = await request(app).delete(`/api/views/${viewB.id}`).set("Cookie", ownerCookie).expect(403);
    expect(del.body.error.code).toBe("FORBIDDEN");

    const listB = await request(app)
      .get(`/api/workspaces/${wsB}/views`)
      .set("Cookie", ownerCookie)
      .expect(403);
    expect(listB.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a nonexistent view on rename and delete", async () => {
    const patch = await request(app).patch(`/api/views/${GHOST}`).set("Cookie", ownerCookie).send({ name: "Ghost" }).expect(404);
    expect(patch.body.error.code).toBe("NOT_FOUND");
    const del = await request(app).delete(`/api/views/${GHOST}`).set("Cookie", ownerCookie).expect(404);
    expect(del.body.error.code).toBe("NOT_FOUND");
  });
});

describe("saved view stale references", () => {
  it("returns a view as stored after its referenced project and label are deleted", async () => {
    const staleProject = await createProject(ownerCookie, wsId, "Doomed");
    const staleLabel = await createLabel(ownerCookie, wsId, "doomed-label");
    const view = await createView(
      ownerCookie,
      wsId,
      "Doomed refs",
      validFilters(staleProject, { status: "Open", labelId: staleLabel })
    );

    await request(app).delete(`/api/projects/${staleProject}`).set("Cookie", ownerCookie).expect(204);
    await request(app).delete(`/api/labels/${staleLabel}`).set("Cookie", ownerCookie).expect(204);

    const list = await request(app).get(`/api/workspaces/${wsId}/views`).set("Cookie", ownerCookie).expect(200);
    const found = list.body.items.find((v: { id: string }) => v.id === view.id);
    expect(found).toBeDefined();
    // Stored config returned unchanged (no mutation, no crash) and still "valid" shape-wise.
    expect(found.filtersValid).toBe(true);
    expect(found.filters).toEqual({ version: 1, projectId: staleProject, status: "Open", labelId: staleLabel });
  });
});

describe("saved view unreadable config", () => {
  it("surfaces malformed stored JSON safely as an unreadable view without mutating it", async () => {
    const malformedId = "11111111-1111-4111-8111-111111111111";
    db.insert(savedViews)
      .values({
        id: malformedId,
        workspaceId: wsId,
        createdById: ownerId,
        name: "Corrupted",
        filters: "not valid json {",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const res = await request(app).get(`/api/workspaces/${wsId}/views`).set("Cookie", ownerCookie).expect(200);
    const found = res.body.items.find((v: { id: string }) => v.id === malformedId);
    expect(found).toBeDefined();
    expect(found.filtersValid).toBe(false);
    expect(found.filters).toBeUndefined();

    // Config untouched in storage.
    const raw = db
      .select({ filters: savedViews.filters })
      .from(savedViews)
      .where(eq(savedViews.id, malformedId))
      .get();
    expect(raw?.filters).toBe("not valid json {");
  });
});
