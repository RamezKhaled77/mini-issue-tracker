import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject, joinWorkspace } from "../helpers.js";
import { createApp } from "../../src/app.js";
import { memberships, users, workspaces } from "../../src/db/schema.js";
import { createUserRecord } from "../../src/domain/user.js";

let app: Express;
let cookie: string;
let wsId: string;
let projectId: string;

beforeAll(async () => {
  app = setupApp();
  cookie = await signupAs("alice@example.com");
  wsId = await createWorkspace(cookie, "Team Alpha");
  projectId = await createProject(cookie, wsId, "Website");
});

describe("issue contract", () => {
  it("creates an issue", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({
        title: "Fix login",
        description: "Login button does nothing",
        status: "Open",
        priority: "High",
      })
      .expect(201);
    expect(res.body.issue.title).toBe("Fix login");
    expect(res.body.issue.status).toBe("Open");
    expect(res.body.issue.priority).toBe("High");
    expect(res.body.issue.labelIds).toEqual([]);
  });

  it("rejects a blank title", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: " ", status: "Open", priority: "Medium" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("rejects an invalid status", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Bad", status: "Pending", priority: "Medium" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("lists issues in the project", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);
  });

  it("gets a single issue", async () => {
    const list = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .expect(200);
    const issueId = list.body.items[0].id;
    const res = await request(app).get(`/api/issues/${issueId}`).set("Cookie", cookie).expect(200);
    expect(res.body.issue.id).toBe(issueId);
  });

  it("updates status, priority, and title via allowlisted fields", async () => {
    const list = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .expect(200);
    const issueId = list.body.items[0].id;
    const res = await request(app)
      .patch(`/api/issues/${issueId}`)
      .set("Cookie", cookie)
      .send({ title: "Fix login v2", status: "In Progress", priority: "Urgent" })
      .expect(200);
    expect(res.body.issue.title).toBe("Fix login v2");
    expect(res.body.issue.status).toBe("In Progress");
    expect(res.body.issue.priority).toBe("Urgent");
  });

  it("deletes an issue", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Temp issue", status: "Open", priority: "Low" })
      .expect(201);
    await request(app).delete(`/api/issues/${created.body.issue.id}`).set("Cookie", cookie).expect(204);
    const res = await request(app)
      .get(`/api/issues/${created.body.issue.id}`)
      .set("Cookie", cookie)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("assignee validation", () => {
  it("rejects assignee outside the workspace", async () => {
    const outsider = await signupAs("outsider@example.com");
    const outsiderId = (await request(app).get("/api/auth/me").set("Cookie", outsider).expect(200)).body.user.id;
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "X", status: "Open", priority: "Medium", assigneeId: outsiderId })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("accepts assignee who is a workspace member", async () => {
    const memberCookie = await signupAs("member@example.com");
    const inviteRes = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", cookie)
      .expect(201);
    await joinWorkspace(memberCookie, inviteRes.body.invitation.token);
    const memberId = (await request(app).get("/api/auth/me").set("Cookie", memberCookie).expect(200)).body.user.id;
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Assigned", status: "Open", priority: "Medium", assigneeId: memberId })
      .expect(201);
    expect(res.body.issue.assigneeId).toBe(memberId);
  });
});

describe("labels", () => {
  it("creates a workspace label", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", cookie)
      .send({ name: "bug" })
      .expect(201);
    expect(res.body.label.name).toBe("bug");
  });

  it("creates an issue with labels and returns them", async () => {
    const labels = await request(app)
      .get(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", cookie)
      .expect(200);
    const labelId = labels.body.items[0].id;
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Labeled", status: "Open", priority: "Medium", labelIds: [labelId] })
      .expect(201);
    expect(res.body.issue.labelIds).toContain(labelId);
  });
});

describe("search and filter (US6)", () => {
  beforeAll(async () => {
    const priority = ["Low", "Medium", "High"];
    const statuses = ["Open", "In Progress", "Closed"];
    for (let i = 0; i < 6; i += 1) {
      await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set("Cookie", cookie)
        .send({
          title: `Issue number ${i}`,
          description: `keyword alpha${i}`,
          status: statuses[i % statuses.length],
          priority: priority[i % priority.length],
        })
        .expect(201);
    }
  });

  it("filters by status", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?status=Closed`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { status: string }) => i.status === "Closed")).toBe(true);
  });

  it("filters by priority", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?priority=High`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.every((i: { priority: string }) => i.priority === "High")).toBe(true);
  });

  it("searches title text", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?search=number%203`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toContain("3");
  });

  it("searches description text", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?search=alpha2`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBe(1);
  });

  it("combines search and filters (AND)", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?search=alpha0&status=Open&priority=Low`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBe(1);
  });

  it("returns empty results when nothing matches", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?search=zzzznotfound`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("paginates results", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues?page=1&pageSize=2`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.total).toBeGreaterThan(2);
  });

  it("outsider cannot search issues in the project", async () => {
    const outsider = await signupAs("nosy@example.com");
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("outsider cannot delete an issue in the project", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Deleteable", status: "Open", priority: "Low" })
      .expect(201);
    const outsider = await signupAs("deleter-outsider@example.com");
    const res = await request(app)
      .delete(`/api/issues/${created.body.issue.id}`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("assignee identity (US2)", () => {
  let assignedId: string;
  let memberId: string;
  let memberName: string;

  beforeAll(async () => {
    const memberCookie = await signupAs("issue-assignee@example.com", "password123", "Priya Patel");
    const inviteRes = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", cookie)
      .expect(201);
    await joinWorkspace(memberCookie, inviteRes.body.invitation.token);
    const me = await request(app).get("/api/auth/me").set("Cookie", memberCookie).expect(200);
    memberId = me.body.user.id;
    memberName = me.body.user.name;
  });

  it("returns assignee { id, name } on create and never exposes passwordHash", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Assigned identity", status: "Open", priority: "High", assigneeId: memberId })
      .expect(201);
    expect(res.body.issue.assigneeId).toBe(memberId);
    expect(res.body.issue.assignee).toEqual({ id: memberId, name: memberName });
    expect(res.body.issue).not.toHaveProperty("passwordHash");
    assignedId = res.body.issue.id;
  });

  it("returns assignee: null for an unassigned issue", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", cookie)
      .send({ title: "Unassigned identity", status: "Open", priority: "Low" })
      .expect(201);
    expect(res.body.issue.assigneeId).toBeNull();
    expect(res.body.issue.assignee).toBeNull();
    expect(res.body.issue).not.toHaveProperty("passwordHash");
  });

  it("keeps assignee in get and list responses", async () => {
    const get = await request(app).get(`/api/issues/${assignedId}`).set("Cookie", cookie).expect(200);
    expect(get.body.issue.assignee).toEqual({ id: memberId, name: memberName });
    expect(get.body.issue).not.toHaveProperty("passwordHash");

    const list = await request(app)
      .get(`/api/projects/${projectId}/issues?search=Assigned%20identity`)
      .set("Cookie", cookie)
      .expect(200);
    const item = list.body.items.find((i: { id: string }) => i.id === assignedId);
    expect(item).toBeDefined();
    expect(item.assignee).toEqual({ id: memberId, name: memberName });
    expect(item).not.toHaveProperty("passwordHash");
  });

  it("preserves assignee across an update", async () => {
    const res = await request(app)
      .patch(`/api/issues/${assignedId}`)
      .set("Cookie", cookie)
      .send({ title: "Assigned identity v2" })
      .expect(200);
    expect(res.body.issue.assigneeId).toBe(memberId);
    expect(res.body.issue.assignee).toEqual({ id: memberId, name: memberName });
    expect(res.body.issue).not.toHaveProperty("passwordHash");
  });

  it("resolves the email local-part for a legacy assignee with null name", async () => {
    const { app: legacyApp, db } = createApp({
      dbPath: ":memory:",
      sessionSecret: "test-secret",
      production: false,
    });
    const passwordHash = await argon2.hash("password123");
    const legacyUser = createUserRecord("legacy-assignee@example.com", passwordHash);
    db.insert(users).values(legacyUser).run();
    db.insert(workspaces)
      .values({
        id: "ws-legacy-issues",
        name: "Legacy Workspace",
        ownerId: legacyUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(memberships)
      .values({ userId: legacyUser.id, workspaceId: "ws-legacy-issues", joinedAt: new Date() })
      .run();

    const signin = await request(legacyApp)
      .post("/api/auth/signin")
      .send({ email: "legacy-assignee@example.com", password: "password123" })
      .expect(200);
    const legacyCookie = signin.headers["set-cookie"][0].split(";")[0];

    const projectRes = await request(legacyApp)
      .post("/api/workspaces/ws-legacy-issues/projects")
      .set("Cookie", legacyCookie)
      .send({ name: "Legacy Project" })
      .expect(201);
    const legacyProjectId = projectRes.body.project.id;

    const created = await request(legacyApp)
      .post(`/api/projects/${legacyProjectId}/issues`)
      .set("Cookie", legacyCookie)
      .send({ title: "Legacy assigned", status: "Open", priority: "Medium", assigneeId: legacyUser.id })
      .expect(201);
    expect(created.body.issue.assignee).toEqual({ id: legacyUser.id, name: "legacy-assignee" });
    expect(created.body.issue).not.toHaveProperty("passwordHash");
  });
});