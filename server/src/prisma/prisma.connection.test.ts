import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("PostgreSQL connection", () => {
  it("executes a lightweight SELECT 1 using the server-only database configuration", async () => {
    expect(process.env.YEMNA_DATABASE_URL).toBeTruthy();

    const rows = await prisma.$queryRaw<Array<{ connection_check: number }>>`
      SELECT 1 AS connection_check
    `;

    expect(rows[0]?.connection_check).toBe(1);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
