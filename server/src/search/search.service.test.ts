import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SearchService } from "./search.service";
function makePrisma(configured = true) { return { isConfigured: vi.fn(() => configured), user: { findMany: vi.fn(async () => []) }, post: { findMany: vi.fn(async () => []) }, community: { findMany: vi.fn(async () => []) } }; }
describe("SearchService", () => { it("يرفض عند غياب قاعدة البيانات", async () => { await expect(new SearchService(makePrisma(false) as never).search("صنعاء")).rejects.toBeInstanceOf(ServiceUnavailableException); }); it("يفرض الحد الأدنى لعبارة البحث", async () => { await expect(new SearchService(makePrisma() as never).search("ا")).rejects.toBeInstanceOf(BadRequestException); }); });
