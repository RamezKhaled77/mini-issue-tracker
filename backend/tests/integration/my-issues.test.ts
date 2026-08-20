import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject } from "../helpers.js";

let app: Express;

beforeAll(async () => {
  app = setupApp();
});

async function createUser(email: string) {
  const cookie = await signupAs(email);
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  return { cookie, id: me.body.user.id };
}

async function createIssue(
  cookie: string,
  projectId: string,
  over: {
    title: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
  }
) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/issues`)
    .set("Cookie", cookie)
    .send({
      title: over.title,
      status: over.status ?? "Open",
      priority: over.priority ?? "Medium",
      ...(over.assigneeId ? { assigneeId: over.assigneeId } : {}),
      ...(over.dueDate ? { dueDate: over.dueDate } : {}),
    })
    .expect(201);
  return res.body.issue as { id: string };
}

describe("my-issues", () => {
  it("requires a session", async () => {
    const res = await request(app).get("/api/my-issues").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns a zeroed overview and empty items for a user with no workspaces", async () => {
    const { cookie } = await createUser("carol@example.com");
    const res = await request(app).get("/api/my-issues").set("Cookie", cookie).expect(200);
    expect(res.body.overview).toEqual({
      total: 0,
      byStatus: { Open: 0, "In Progress": 0, Closed: 0 },
      overdue: 0,
    });
    expect(res.body.items).toEqual([]);
  });

  it("aggregates assigned issues across workspaces with project/workspace context", async () => {
    const { cookie, id } = await createUser("alice@example.com");
    const wsA = await createWorkspace(cookie, "Team Alpha");
    const wsB = await createWorkspace(cookie, "Team Beta");
    const projA = await createProject(cookie, wsA, "App One");
    const projB = await createProject(cookie, wsB, "App Two");

    await createIssue(cookie, projA, { title: "One", assigneeId: id });
    await createIssue(cookie, projB, { title: "Two", assigneeId: id });
    await createIssue(cookie, projA, { title: "Unassigned" });

    const res = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.overview.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    const byTitle = Object.fromEntries(res.body.items.map((i: { title: string }) => [i.title, i]));
    expect(byTitle.One.workspaceName).toBe("Team Alpha");
    expect(byTitle.One.projectName).toBe("App One");
    expect(byTitle.One.workspaceId).toBe(wsA);
    expect(byTitle.Two.workspaceName).toBe("Team Beta");
    expect(byTitle.Two.projectName).toBe("App Two");
    expect(byTitle.Two.workspaceId).toBe(wsB);
  });

  it("derives overdue only for past-due, non-closed issues", async () => {
    const { cookie, id } = await createUser("dave@example.com");
    const ws = await createWorkspace(cookie, "Due Workspace");
    const proj = await createProject(cookie, ws, "Due App");

    await createIssue(cookie, proj, { title: "Past Open", assigneeId: id, status: "Open", dueDate: "2000-01-01" });
    await createIssue(cookie, proj, { title: "Past In Progress", assigneeId: id, status: "In Progress", dueDate: "2000-01-01" });
    await createIssue(cookie, proj, { title: "No due date", assigneeId: id });
    await createIssue(cookie, proj, { title: "Closed past", assigneeId: id, status: "Closed", dueDate: "2000-01-01" });

    const res = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.overview.overdue).toBe(2);
    expect(res.body.overview.byStatus).toEqual({ Open: 2, "In Progress": 1, Closed: 1 });
  });

  it("defaults to active-only items; includeClosed=true matches the total", async () => {
    const { cookie, id } = await createUser("erin@example.com");
    const ws = await createWorkspace(cookie, "Status Workspace");
    const proj = await createProject(cookie, ws, "Status App");

    await createIssue(cookie, proj, { title: "Open A", assigneeId: id, status: "Open" });
    await createIssue(cookie, proj, { title: "In Progress B", assigneeId: id, status: "In Progress" });
    await createIssue(cookie, proj, { title: "Closed C", assigneeId: id, status: "Closed" });

    const active = await request(app).get("/api/my-issues").set("Cookie", cookie).expect(200);
    expect(active.body.overview.total).toBe(3);
    expect(active.body.items.map((i: { title: string }) => i.title).sort()).toEqual(["In Progress B", "Open A"]);

    const all = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", cookie)
      .expect(200);
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items).toHaveLength(all.body.overview.total);
  });

  it("isolates by assignee and excludes issues in workspaces the user can no longer reach", async () => {
    const owner = await createUser("owner@example.com");
    const ws = await createWorkspace(owner.cookie, "Shared Workspace");
    const proj = await createProject(owner.cookie, ws, "Shared App");

    const bob = await createUser("bob@example.com");
    const invite = await request(app)
      .post(`/api/workspaces/${ws}/invitations`)
      .set("Cookie", owner.cookie)
      .expect(201);
    await request(app)
      .post("/api/workspaces/join")
      .set("Cookie", bob.cookie)
      .send({ token: invite.body.invitation.token })
      .expect(200);

    await createIssue(owner.cookie, proj, { title: "Assigned to Bob", assigneeId: bob.id });
    await createIssue(owner.cookie, proj, { title: "Assigned to Owner", assigneeId: owner.id });

    const bobsView = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", bob.cookie)
      .expect(200);
    expect(bobsView.body.items.map((i: { title: string }) => i.title)).toEqual(["Assigned to Bob"]);
    expect(bobsView.body.overview.total).toBe(1);

    await request(app)
      .delete(`/api/workspaces/${ws}/members/${bob.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    const afterRemoval = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", bob.cookie)
      .expect(200);
    expect(afterRemoval.body.overview.total).toBe(0);
    expect(afterRemoval.body.items).toEqual([]);
  });

  it("sorts overdue first, then due date, then priority, then title", async () => {
    const { cookie, id } = await createUser("frank@example.com");
    const ws = await createWorkspace(cookie, "Sort Workspace");
    const proj = await createProject(cookie, ws, "Sort App");

    await createIssue(cookie, proj, { title: "Lowest title z", assigneeId: id, priority: "Low" });
    await createIssue(cookie, proj, { title: "aaa overdue", assigneeId: id, priority: "Low", dueDate: "2000-01-01" });
    await createIssue(cookie, proj, { title: "bbb overdue", assigneeId: id, priority: "High", dueDate: "2000-01-01" });
    await createIssue(cookie, proj, { title: "zzz future", assigneeId: id, priority: "Urgent", dueDate: "2999-01-01" });
    await createIssue(cookie, proj, { title: "aaa no date", assigneeId: id, priority: "Urgent" });

    const res = await request(app)
      .get("/api/my-issues")
      .set("Cookie", cookie)
      .expect(200);

    const titles = res.body.items.map((i: { title: string }) => i.title);
    expect(titles[0]).toBe("bbb overdue");
    expect(titles[1]).toBe("aaa overdue");
    expect(titles[2]).toBe("zzz future");
    expect(titles[3]).toBe("aaa no date");
    expect(titles[4]).toBe("Lowest title z");
  });

  it("keeps byStatus consistent with the total", async () => {
    const { cookie, id } = await createUser("grace@example.com");
    const ws = await createWorkspace(cookie, "Consistency Workspace");
    const proj = await createProject(cookie, ws, "Consistency App");

    await createIssue(cookie, proj, { title: "O1", assigneeId: id, status: "Open" });
    await createIssue(cookie, proj, { title: "P1", assigneeId: id, status: "In Progress" });
    await createIssue(cookie, proj, { title: "C1", assigneeId: id, status: "Closed" });

    const res = await request(app)
      .get("/api/my-issues?includeClosed=true")
      .set("Cookie", cookie)
      .expect(200);
    const s = res.body.overview.byStatus;
    expect(s.Open + s["In Progress"] + s.Closed).toBe(res.body.overview.total);
  });
});