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

async function seedIssues() {
  const p1 = await createProject(cookie, wsId, "App One");
  const p2 = await createProject(cookie, wsId, "App Two");
  const fixtures = [
    { title: "A", status: "Open", priority: "Low", project: p1 },
    { title: "B", status: "Open", priority: "Medium", project: p1 },
    { title: "C", status: "In Progress", priority: "High", project: p2 },
    { title: "D", status: "Closed", priority: "Urgent", project: p2 },
  ];
  for (const f of fixtures) {
    await request(app)
      .post(`/api/projects/${f.project}/issues`)
      .set("Cookie", cookie)
      .send({ title: f.title, status: f.status, priority: f.priority })
      .expect(201);
  }
}

async function seedIssuesInWorkspace(workspaceId: string) {
  const p1 = await createProject(cookie, workspaceId, "App One");
  const p2 = await createProject(cookie, workspaceId, "App Two");
  const fixtures = [
    { title: "A", status: "Open", priority: "Low", project: p1 },
    { title: "B", status: "Open", priority: "Medium", project: p1 },
    { title: "C", status: "In Progress", priority: "High", project: p2 },
    { title: "D", status: "Closed", priority: "Urgent", project: p2 },
  ];
  for (const f of fixtures) {
    await request(app)
      .post(`/api/projects/${f.project}/issues`)
      .set("Cookie", cookie)
      .send({ title: f.title, status: f.status, priority: f.priority })
      .expect(201);
  }
}

describe("dashboard", () => {
  it("returns zero counts when there are no issues", async () => {
    const emptyWs = await createWorkspace(cookie, "Empty");
    const res = await request(app)
      .get(`/api/workspaces/${emptyWs}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBe(0);
    expect(res.body.byStatus).toEqual({ Open: 0, "In Progress": 0, Closed: 0 });
    expect(res.body.byPriority).toEqual({ Low: 0, Medium: 0, High: 0, Urgent: 0 });
  });

  it("counts issues by status and priority across projects", async () => {
    await seedIssues();
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.byStatus).toEqual({ Open: 2, "In Progress": 1, Closed: 1 });
    expect(res.body.byPriority).toEqual({ Low: 1, Medium: 1, High: 1, Urgent: 1 });
  });

  it("includes overdue count in the dashboard response", async () => {
    // Use a separate workspace so we don't interfere with other tests' counts.
    const overdueWs = await createWorkspace(cookie, "Overdue Test");
    const proj = await createProject(cookie, overdueWs, "App Four");
    await request(app)
      .post(`/api/projects/${proj}/issues`)
      .set("Cookie", cookie)
      .send({
        title: "Overdue issue",
        status: "Open",
        priority: "High",
        dueDate: "2020-01-01",
      })
      .expect(201);

    const res = await request(app)
      .get(`/api/workspaces/${overdueWs}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.overdue).toBe(1);
  });

  it("workspace overview returns full dashboard payload", async () => {
    // Use a separate workspace to avoid interference with other tests' counts.
    const overviewWs = await createWorkspace(cookie, "Overview Test");
    await seedIssuesInWorkspace(overviewWs);

    const res = await request(app)
      .get(`/api/workspaces/${overviewWs}/overview`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.workspace.name).toBe("Overview Test");
    expect(res.body.workspace.isOwner).toBe(true);
    expect(res.body.stats.total).toBe(4);
    expect(res.body.stats.byStatus).toEqual({ Open: 2, "In Progress": 1, Closed: 1 });
    expect(res.body.stats.overdue).toBeGreaterThanOrEqual(0);

    // Projects with issue counts.
    expect(res.body.projects.length).toBeGreaterThanOrEqual(2);
    for (const p of res.body.projects) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("issueCount");
      expect(p).toHaveProperty("lastActivity");
      expect(typeof p.issueCount).toBe("number");
    }

    // My issues, overdue issues, and recent activity are arrays.
    expect(Array.isArray(res.body.myIssues)).toBe(true);
    expect(Array.isArray(res.body.overdueIssues)).toBe(true);
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
  });

  it("workspace overview is forbidden for outsiders", async () => {
    const outsider = await signupAs("viewer2@example.com");
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/overview`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("updates counts when an issue changes status", async () => {
    const proj = await createProject(cookie, wsId, "App Three");
    const created = await request(app)
      .post(`/api/projects/${proj}/issues`)
      .set("Cookie", cookie)
      .send({ title: "E", status: "Open", priority: "Low" })
      .expect(201);
    const issueId = created.body.issue.id;

    let res = await request(app)
      .get(`/api/workspaces/${wsId}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.byStatus.Open).toBe(3);

    await request(app)
      .patch(`/api/issues/${issueId}`)
      .set("Cookie", cookie)
      .send({ status: "Closed" })
      .expect(200);

    res = await request(app)
      .get(`/api/workspaces/${wsId}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.byStatus.Open).toBe(2);
    expect(res.body.byStatus.Closed).toBe(2);
  });

  it("outsider cannot view the dashboard", async () => {
    const outsider = await signupAs("viewer@example.com");
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/dashboard`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});