import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SearchService } from "./search.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    user: { findMany: vi.fn(async () => ["user"]) },
    post: { findMany: vi.fn(async () => ["post"]) },
    community: { findMany: vi.fn(async () => ["community"]) },
  };
}

describe("SearchService", () => {
  it("يرفض عند غياب قاعدة البيانات", async () => {
    await expect(new SearchService(makePrisma(false) as never).search("صنعاء")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("يفرض الحد الأدنى لعبارة البحث", async () => {
    await expect(new SearchService(makePrisma() as never).search("ا")).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ["users", { users: ["user"], usersNextPage: null, posts: [], communities: [] }],
    ["posts", { users: [], posts: ["post"], communities: [] }],
    ["communities", { users: [], posts: [], communities: ["community"] }],
  ] as const)("يعيد عقداً كاملاً عند فلتر %s", async (type, expected) => {
    const service = new SearchService(makePrisma() as never);

    await expect(service.search("صنعاء", type)).resolves.toEqual(expected);
  });

  it("يدعم صفحات دليل المستخدمين بحد أقصى آمن", async () => {
    const prisma = makePrisma() as ReturnType<typeof makePrisma>;
    prisma.user.findMany = vi.fn(async () => Array.from({ length: 4 }, (_, index) => `user-${index}`));
    const service = new SearchService(prisma as never);

    await expect(service.search("صنعاء", "users", 2, 3)).resolves.toMatchObject({ users: ["user-0", "user-1", "user-2"], usersNextPage: 3 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4, skip: 3 }));
  });
});
