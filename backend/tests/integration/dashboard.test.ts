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