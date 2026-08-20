import { describe, expect, it, vi } from "vitest";
import { SearchController } from "./search.controller";

describe("SearchController", () => {
  it("يمرر عبارة البحث ونوعها إلى SearchService المحقونة", async () => {
    const result = { users: [], posts: [], communities: [] };
    const searchService = { search: vi.fn().mockResolvedValue(result) };
    const controller = new SearchController(searchService as never);

    await expect(controller.search({ q: "يمنا", type: "all" })).resolves.toEqual(result);
    expect(searchService.search).toHaveBeenCalledWith("يمنا", "all");
  });
});
