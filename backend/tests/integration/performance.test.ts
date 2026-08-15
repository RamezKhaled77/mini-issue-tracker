import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { issues } from "../../src/db/schema.js";
import { createIssueRecord } from "../../src/domain/issue.js";

const SC004_BUDGET_MS = 2000;
const SEED_COUNT = 1000;

let app: Express;
let cookie: string;
let projectId: string;
let seedDb: ReturnType<typeof createApp>["db"];

async function signup(app: Express, email: string) {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password123", name: "Test User" })
    .expect(201);
  return res.headers["set-cookie"][0].split(";")[0];
}

async function createWorkspace(app: Express, cookie: string, name: string) {
  const res = await request(app).post("/api/workspaces").set("Cookie", cookie).send({ name }).expect(201);
  return res.body.workspace.id;
}

async function createProject(app: Express, cookie: string, workspaceId: string, name: string) {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set("Cookie", cookie)
    .send({ name })
    .expect(201);
  return res.body.project.id;
}

beforeAll(async () => {
  const created = createApp({
    dbPath: ":memory:",
    sessionSecret: "test-secret",
    production: false,
    enableRateLimit: false,
  });
  app = created.app;
  seedDb = created.db;

  cookie = await signup(app, "perf@example.com");
  const wsId = await createWorkspace(app, cookie, "Perf Workspace");
  projectId = await createProject(app, cookie, wsId, "Big Project");

  const rows = Array.from({ length: SEED_COUNT }, (_, i) =>
    createIssueRecord(projectId, {
      title: i % 2 === 0 ? `Login page error #${i}` : `Dashboard widget #${i}`,
      description: i % 3 === 0 ? `Regression found in release ${i % 10}` : `Minor cosmetic tweak ${i}`,
      status: (["Open", "In Progress", "Closed"] as const)[i % 3],
      priority: (["Low", "Medium", "High", "Urgent"] as const)[i % 4],
      dueDate: i % 5 === 0 ? "2026-12-31" : null,
    })
  );
  for (const row of rows) {
    seedDb.insert(issues).values(row).run();
  }
});

async function timeRequest(path: string) {
  const start = performance.now();
  const res = await request(app).get(path).set("Cookie", cookie).expect(200);
  const elapsed = performance.now() - start;
  return { elapsed, res };
}

describe("performance (SC-004)", () => {
  it(`seed reflects ${SEED_COUNT} issues in the project`, async () => {
    const { res } = await timeRequest(`/api/projects/${projectId}/issues?pageSize=1`);
    expect(res.body.total).toBe(SEED_COUNT);
  });

  it("search returns matches well under the 2s budget", async () => {
    const { elapsed, res } = await timeRequest(
      `/api/projects/${projectId}/issues?search=Login%20page&pageSize=50`
    );
    expect(elapsed).toBeLessThan(SC004_BUDGET_MS);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("combined filter (status + priority) returns under the 2s budget", async () => {
    const { elapsed, res } = await timeRequest(
      `/api/projects/${projectId}/issues?status=Open&priority=High&pageSize=50`
    );
    expect(elapsed).toBeLessThan(SC004_BUDGET_MS);
    for (const item of res.body.items) {
      expect(item.status).toBe("Open");
      expect(item.priority).toBe("High");
    }
  });

  it("search + filter combined (AND) returns under the 2s budget", async () => {
    const { elapsed, res } = await timeRequest(
      `/api/projects/${projectId}/issues?search=Login%20page&status=Open&pageSize=50`
    );
    expect(elapsed).toBeLessThan(SC004_BUDGET_MS);
    for (const item of res.body.items) {
      expect(item.status).toBe("Open");
    }
  });

  it("paged traversal across all 1,000 issues stays under the 2s budget per page", async () => {
    for (let page = 1; page <= 10; page += 1) {
      const { elapsed } = await timeRequest(
        `/api/projects/${projectId}/issues?page=${page}&pageSize=100`
      );
      expect(elapsed).toBeLessThan(SC004_BUDGET_MS);
    }
  });
});
