import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../src/db/migrations");

function migrationSql(version: number): string {
  const prefix = String(version).padStart(4, "0");
  const file = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.startsWith(`${prefix}_`))
    .sort()[0];
  return fs.readFileSync(path.join(migrationsDir, file), "utf8");
}

describe("migration 0002_user_display_name (SC-006)", () => {
  it("applies cleanly to a 0001-schema database and preserves existing rows with a null name", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    sqlite.exec(migrationSql(1));
    sqlite.pragma("user_version = 1");

    sqlite
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("u-legacy", "legacy@example.com", "hash", Date.now(), Date.now());
    sqlite
      .prepare(
        `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("ws-1", "Legacy Workspace", "u-legacy", Date.now(), Date.now());

    runMigrations(sqlite);

    expect(sqlite.pragma("user_version", { simple: true })).toBe(6);

    const user = sqlite
      .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
      .get("u-legacy") as { id: string; email: string; name: string | null };
    expect(user.id).toBe("u-legacy");
    expect(user.email).toBe("legacy@example.com");
    expect(user.name).toBeNull();

    const workspace = sqlite
      .prepare(`SELECT id, name, owner_id FROM workspaces WHERE id = ?`)
      .get("ws-1") as { id: string; name: string; owner_id: string };
    expect(workspace.name).toBe("Legacy Workspace");
    expect(workspace.owner_id).toBe("u-legacy");

    sqlite.close();
  });

  it("adds a nullable name column without touching other tables (non-destructive)", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    sqlite.exec(migrationSql(1));
    sqlite.pragma("user_version = 1");
    runMigrations(sqlite);

    const columns = sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string; notnull: number }[];
    const nameCol = columns.find((c) => c.name === "name");
    expect(nameCol).toBeDefined();
    expect(nameCol!.notnull).toBe(0);

    const tables = (sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as { name: string }[]).map((t) => t.name);
    expect(tables).toContain("users");
    expect(tables).toContain("issues");
    expect(tables).toContain("comments");

    const userColumns = columns.map((c) => c.name);
    expect(userColumns).toContain("name");
    expect(userColumns).toEqual(
      expect.arrayContaining(["id", "email", "password_hash", "created_at", "updated_at"])
    );

    sqlite.close();
  });

  describe("migration 0003_label_color (SC-007)", () => {
    it("applies cleanly to a 0001+0002 database and gives legacy labels the default color", () => {
      const sqlite = new Database(":memory:");
      sqlite.pragma("foreign_keys = ON");

      sqlite.exec(migrationSql(1));
      sqlite.exec(migrationSql(2));
      sqlite.pragma("user_version = 2");

      sqlite
        .prepare(
          `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .run("u-legacy", "legacy@example.com", "hash", Date.now(), Date.now());
      sqlite
        .prepare(
          `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .run("ws-1", "Legacy Workspace", "u-legacy", Date.now(), Date.now());
      sqlite
        .prepare(`INSERT INTO labels (id, workspace_id, name) VALUES (?, ?, ?)`)
        .run("l-1", "ws-1", "bug");

      runMigrations(sqlite);

      expect(sqlite.pragma("user_version", { simple: true })).toBe(6);

      const label = sqlite
        .prepare(`SELECT id, workspace_id, name, color FROM labels WHERE id = ?`)
        .get("l-1") as { id: string; workspace_id: string; name: string; color: string };
      expect(label.id).toBe("l-1");
      expect(label.workspace_id).toBe("ws-1");
      expect(label.name).toBe("bug");
      expect(label.color).toBe("violet");

      const tables = (sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all() as { name: string }[]).map((t) => t.name);
      expect(tables).toContain("labels");
      expect(tables).toContain("issue_labels");
      expect(tables).toContain("issues");

      sqlite.close();
    });

    it("adds a not-null color column without touching other tables (non-destructive)", () => {
      const sqlite = new Database(":memory:");
      sqlite.pragma("foreign_keys = ON");

      sqlite.exec(migrationSql(1));
      sqlite.exec(migrationSql(2));
      sqlite.pragma("user_version = 2");
      runMigrations(sqlite);

      const columns = sqlite.prepare(`PRAGMA table_info(labels)`).all() as {
        name: string;
        notnull: number;
        dflt_value: string | null;
      }[];
      const colorCol = columns.find((c) => c.name === "color");
      expect(colorCol).toBeDefined();
      expect(colorCol!.notnull).toBe(1);
      expect(colorCol!.dflt_value).toBe("'violet'");

      const labelColumns = columns.map((c) => c.name);
      expect(labelColumns).toEqual(expect.arrayContaining(["id", "workspace_id", "name", "color"]));

      sqlite.close();
    });
  });
});

describe("migration 0005_activity_timestamp_ms", () => {
  const SEED_MS = Date.now();

  function seedIssueChain(sqlite: Database.Database) {
    sqlite
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("u-1", "actor@example.com", "hash", SEED_MS, SEED_MS);
    sqlite
      .prepare(
        `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("ws-1", "Workspace", "u-1", SEED_MS, SEED_MS);
    sqlite
      .prepare(
        `INSERT INTO projects (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("p-1", "ws-1", "Project", SEED_MS, SEED_MS);
    sqlite
      .prepare(
        `INSERT INTO issues (id, project_id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run("i-1", "p-1", "Issue", "Open", "Medium", SEED_MS, SEED_MS);
  }

  function insertActivity(sqlite: Database.Database, id: string, createdAt: number) {
    sqlite
      .prepare(
        `INSERT INTO activities (id, issue_id, actor_id, type, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, "i-1", "u-1", "issue.created", createdAt);
  }

  function getCreatedAt(sqlite: Database.Database, id: string): number {
    return (
      sqlite.prepare(`SELECT created_at FROM activities WHERE id = ?`).get(id) as {
        created_at: number;
      }
    ).created_at;
  }

  it("converts legacy seconds-based activity timestamps to milliseconds", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    for (const version of [1, 2, 3, 4]) {
      sqlite.exec(migrationSql(version));
    }
    sqlite.pragma("user_version = 4");

    seedIssueChain(sqlite);
    insertActivity(sqlite, "a-legacy-seconds", 1787331428);

    runMigrations(sqlite);

    expect(sqlite.pragma("user_version", { simple: true })).toBe(6);
    expect(getCreatedAt(sqlite, "a-legacy-seconds")).toBe(1787331428000);

    sqlite.close();
  });

  it("leaves already-millisecond timestamps untouched", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    for (const version of [1, 2, 3, 4]) {
      sqlite.exec(migrationSql(version));
    }
    sqlite.pragma("user_version = 4");

    seedIssueChain(sqlite);
    insertActivity(sqlite, "a-modern-ms", 1787338116852);

    runMigrations(sqlite);

    expect(getCreatedAt(sqlite, "a-modern-ms")).toBe(1787338116852);

    sqlite.close();
  });
});

describe("migration 0006_saved_views", () => {
  it("applies cleanly to a 0005 schema and creates the saved_views table with indexes", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    for (const version of [1, 2, 3, 4, 5]) {
      sqlite.exec(migrationSql(version));
    }
    sqlite.pragma("user_version = 5");

    runMigrations(sqlite);

    expect(sqlite.pragma("user_version", { simple: true })).toBe(6);

    const tables = (sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as { name: string }[]).map((t) => t.name);
    expect(tables).toContain("saved_views");

    const cols = sqlite.prepare(`PRAGMA table_info(saved_views)`).all() as {
      name: string;
      notnull: number;
    }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).toEqual(
      expect.arrayContaining([
        "id",
        "workspace_id",
        "created_by_id",
        "name",
        "filters",
        "created_at",
        "updated_at",
      ])
    );

    const indexes = (sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'saved_views' ORDER BY name`
      )
      .all() as { name: string }[]).map((i) => i.name);
    expect(indexes).toContain("saved_views_workspace_name_idx");
    expect(indexes).toContain("saved_views_workspace_idx");
    expect(indexes).toContain("saved_views_created_by_idx");

    sqlite.close();
  });
});