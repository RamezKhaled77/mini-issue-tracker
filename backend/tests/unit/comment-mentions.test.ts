import { describe, expect, it, beforeEach, vi } from "vitest";
import { createCommentService } from "../../src/services/comment.js";
import { ApiError } from "../../src/api/middleware/error-handler.js";

function createMockDb() {
  const run = vi.fn();
  const getAll = vi.fn();
  const getOne = vi.fn();

  function makeSelectBuilder() {
    return {
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn(() => ({ all: getAll })) })),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ all: getAll })),
        })),
        where: vi.fn(() => ({ get: getOne, all: getAll })),
      })),
    };
  }

  const db = {
    transaction: vi.fn((fn: () => unknown) => fn()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ run })) })),
    select: vi.fn(makeSelectBuilder),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ run })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ run })) })) })),
  };

  return { db, run, getAll, getOne };
}

describe("comment service — mentions", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: ReturnType<typeof createCommentService>;

  const mockProjectService = {
    getWorkspaceIdForIssue: vi.fn(),
  };
  const mockMembershipService = {
    requireMember: vi.fn(),
  };

  beforeEach(() => {
    mockDb = createMockDb();
    mockProjectService.getWorkspaceIdForIssue.mockReturnValue("ws-1");
    mockMembershipService.requireMember.mockReturnValue(undefined);
    service = createCommentService({
      db: mockDb.db as unknown as Parameters<typeof createCommentService>[0]["db"],
      projectService: mockProjectService as unknown as Parameters<typeof createCommentService>[0]["projectService"],
      membershipService: mockMembershipService as unknown as Parameters<typeof createCommentService>[0]["membershipService"],
    });
  });

  it("adds a comment without mentions", () => {
    mockDb.getAll.mockReturnValue([]);
    const result = service.addComment("issue-1", "author-1", "Hello");
    expect(result.body).toBe("Hello");
    expect(result.mentions).toEqual([]);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it("adds a comment with mentions and enriches the response", () => {
    mockDb.getAll.mockReturnValue([{ userId: "member-1" }]);
    mockDb.getOne
      .mockReturnValueOnce({ id: "author-1", name: "Alice", email: "alice@example.com" })
      .mockReturnValueOnce({ name: "Bob" })
      .mockReturnValueOnce({ email: "bob@example.com" });

    const result = service.addComment("issue-1", "author-1", "Hey @Bob", ["member-1"]);
    expect(result.body).toBe("Hey @Bob");
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0].userId).toBe("member-1");
    expect(result.mentions[0].name).toBe("Bob");
  });

  it("rejects a mention of a non-member with 422", () => {
    mockDb.getAll.mockReturnValue([{ userId: "member-1" }]);

    expect(() => service.addComment("issue-1", "author-1", "Hey @stranger", ["non-member-uuid"]))
      .toThrow(ApiError);
  });

  it("rejects a self-mention with 422", () => {
    mockDb.getAll.mockReturnValue([{ userId: "author-1" }]);

    expect(() => service.addComment("issue-1", "author-1", "Hey @me", ["author-1"]))
      .toThrow(ApiError);
  });

  it("deduplicates mention ids before validation", () => {
    mockDb.getAll.mockReturnValue([{ userId: "member-1" }]);

    service.addComment("issue-1", "author-1", "Hey", ["member-1", "member-1", "member-1"]);
    expect(mockDb.db.insert).toHaveBeenCalledTimes(2);
  });

  it("rejects all mentions when any one is invalid", () => {
    mockDb.getAll.mockReturnValue([{ userId: "member-1" }]);

    expect(() =>
      service.addComment("issue-1", "author-1", "Hey", ["member-1", "non-member-uuid"])
    ).toThrow(ApiError);
  });
});