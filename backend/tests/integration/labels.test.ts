import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject, joinWorkspace } from "../helpers.js";

let app: Express;
let ownerCookie: string;
let wsId: string;
let projectId: string;

beforeAll(async () => {
  app = setupApp();
  ownerCookie = await signupAs("labs-owner@example.com");
  wsId = await createWorkspace(ownerCookie, "Label Workspace");
  projectId = await createProject(ownerCookie, wsId, "Website");
});

describe("label contract", () => {
  it("creates a label with name and color and returns the full shape", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "bug", color: "violet" })
      .expect(201);
    expect(res.body.label).toEqual(
      expect.objectContaining({ id: expect.any(String), workspaceId: wsId, name: "bug", color: "violet" })
    );
  });

  it("rejects a missing or invalid color with a 422 field error on color", async () => {
    const missing = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "nocolor" })
      .expect(422);
    expect(missing.body.error.code).toBe("VALIDATION");
    expect(missing.body.error.fields.color).toBeDefined();

    const invalid = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "badcolor", color: "hotpink" })
      .expect(422);
    expect(invalid.body.error.fields.color).toBeDefined();
  });

  it("rejects blank, whitespace-only, and over-length names", async () => {
    for (const name of ["", "   "]) {
      const res = await request(app)
        .post(`/api/workspaces/${wsId}/labels`)
        .set("Cookie", ownerCookie)
        .send({ name, color: "violet" })
        .expect(422);
      expect(res.body.error.fields.name).toBe("Label name is required");
    }
    const long = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "x".repeat(51), color: "violet" })
      .expect(422);
    expect(long.body.error.fields.name).toBeDefined();
  });

  it("rejects a duplicate name within a workspace with 409 (create and rename)", async () => {
    await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "duplicate", color: "indigo" })
      .expect(201);
    await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "taken", color: "sand" })
      .expect(201);

    const create = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "duplicate", color: "plum" })
      .expect(409);
    expect(create.body.error.code).toBe("CONFLICT");

    const list = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const duplicate = list.body.items.find((l: { name: string }) => l.name === "duplicate");
    const rename = await request(app)
      .patch(`/api/labels/${duplicate.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "taken" })
      .expect(409);
    expect(rename.body.error.code).toBe("CONFLICT");
  });

  it("treats Bug and bug as distinct labels (case-sensitive)", async () => {
    await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "Bug", color: "magenta" })
      .expect(201);

    const list = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const names = list.body.items.map((l: { name: string }) => l.name);
    expect(names).toContain("Bug");
    expect(names).toContain("bug");
  });

  it("allows the same label name in different workspaces", async () => {
    const otherCookie = await signupAs("second-ws@example.com");
    const otherWs = await createWorkspace(otherCookie, "Second Workspace");
    await request(app)
      .post(`/api/workspaces/${otherWs}/labels`)
      .set("Cookie", otherCookie)
      .send({ name: "bug", color: "olive" })
      .expect(201);
  });

  it("lists labels ordered by name ascending", async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const names = res.body.items.map((l: { name: string }) => l.name);
    expect(names).toEqual([...names].sort());
    expect(res.body.items.every((l: { color: string }) => typeof l.color === "string")).toBe(true);
  });

  it("renames and re-colors a label", async () => {
    const created = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "frontend", color: "indigo" })
      .expect(201);

    const renamed = await request(app)
      .patch(`/api/labels/${created.body.label.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "frontend-ui" })
      .expect(200);
    expect(renamed.body.label.name).toBe("frontend-ui");
    expect(renamed.body.label.color).toBe("indigo");

    const recolored = await request(app)
      .patch(`/api/labels/${created.body.label.id}`)
      .set("Cookie", ownerCookie)
      .send({ color: "sand" })
      .expect(200);
    expect(recolored.body.label.color).toBe("sand");
    expect(recolored.body.label.name).toBe("frontend-ui");
  });

  it("allows renaming a label to its own current name (no-op)", async () => {
    const list = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const frontend = list.body.items.find((l: { name: string }) => l.name === "frontend-ui");
    const res = await request(app)
      .patch(`/api/labels/${frontend.id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "frontend-ui" })
      .expect(200);
    expect(res.body.label.name).toBe("frontend-ui");
  });

  it("deletes a label and it disappears from the list", async () => {
    const created = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "doomed", color: "plum" })
      .expect(201);
    const id = created.body.label.id;

    await request(app).delete(`/api/labels/${id}`).set("Cookie", ownerCookie).expect(204);

    const list = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(list.body.items.find((l: { id: string }) => l.id === id)).toBeUndefined();
  });
});

describe("label authorization", () => {
  it("rejects unauthenticated create/list/patch/delete with 401", async () => {
    await request(app).post(`/api/workspaces/${wsId}/labels`).send({ name: "x", color: "violet" }).expect(401);
    await request(app).get(`/api/workspaces/${wsId}/labels`).expect(401);
    await request(app).patch("/api/labels/00000000-0000-4000-8000-000000000000").send({ name: "y" }).expect(401);
    await request(app).delete("/api/labels/00000000-0000-4000-8000-000000000000").expect(401);
  });

  it("rejects a non-member creating or listing labels with 403", async () => {
    const outsider = await signupAs("label-outsider@example.com");
    const create = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", outsider)
      .send({ name: "sneak", color: "violet" })
      .expect(403);
    expect(create.body.error.code).toBe("FORBIDDEN");
    const list = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", outsider)
      .expect(403);
    expect(list.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a member of workspace A patching or deleting workspace B's label", async () => {
    const memberACookie = await signupAs("member-a@example.com");
    const invite = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", ownerCookie)
      .expect(201);
    await joinWorkspace(memberACookie, invite.body.invitation.token);

    const wsB = await createWorkspace(memberACookie, "Workspace B");
    const labelB = await request(app)
      .post(`/api/workspaces/${wsB}/labels`)
      .set("Cookie", memberACookie)
      .send({ name: "secret", color: "plum" })
      .expect(201);
    const labelBId = labelB.body.label.id;

    const patch = await request(app)
      .patch(`/api/labels/${labelBId}`)
      .set("Cookie", ownerCookie)
      .send({ name: "hijacked" })
      .expect(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");

    const del = await request(app)
      .delete(`/api/labels/${labelBId}`)
      .set("Cookie", ownerCookie)
      .expect(403);
    expect(del.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a nonexistent label on patch and delete", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    const patch = await request(app)
      .patch(`/api/labels/${ghost}`)
      .set("Cookie", ownerCookie)
      .send({ name: "ghost" })
      .expect(404);
    expect(patch.body.error.code).toBe("NOT_FOUND");
    const del = await request(app).delete(`/api/labels/${ghost}`).set("Cookie", ownerCookie).expect(404);
    expect(del.body.error.code).toBe("NOT_FOUND");
  });
});

describe("labels in issues (integration)", () => {
  let bugId: string;

  beforeAll(async () => {
    const bug = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "api-bug", color: "violet" })
      .expect(201);
    bugId = bug.body.label.id;
  });

  it("returns embedded labels (id, name, color) on create/get/list/update", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", ownerCookie)
      .send({ title: "Embedded labels", status: "Open", priority: "Medium", labelIds: [bugId] })
      .expect(201);
    expect(created.body.issue.labels).toContainEqual(
      expect.objectContaining({ id: bugId, name: "api-bug", color: "violet" })
    );
    expect(created.body.issue.labelIds).toContain(bugId);
    const issueId = created.body.issue.id;

    const get = await request(app).get(`/api/issues/${issueId}`).set("Cookie", ownerCookie).expect(200);
    expect(get.body.issue.labels).toContainEqual(expect.objectContaining({ id: bugId }));

    const list = await request(app)
      .get(`/api/projects/${projectId}/issues?search=Embedded`)
      .set("Cookie", ownerCookie)
      .expect(200);
    expect(list.body.items[0].labels).toContainEqual(expect.objectContaining({ id: bugId }));

    const updated = await request(app)
      .patch(`/api/issues/${issueId}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [] })
      .expect(200);
    expect(updated.body.issue.labels).toEqual([]);
    expect(updated.body.issue.labelIds).toEqual([]);
  });
});