import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const testEmail = `test-${crypto.randomUUID()}@example.invalid`;

describe("Prisma user round-trip", () => {
  it("creates and reads a transient user record", async () => {
    const created = await prisma.user.create({
      data: {
        email: testEmail,
        displayName: "مستخدم اختبار مؤقت",
        passwordHash: "non-authentic-test-hash",
      },
    });

    const found = await prisma.user.findUnique({
      where: { id: created.id },
      select: { id: true, email: true, displayName: true, status: true },
    });

    expect(found).toMatchObject({
      id: created.id,
      email: testEmail,
      displayName: "مستخدم اختبار مؤقت",
      status: "ACTIVE",
    });

    await prisma.user.delete({ where: { id: created.id } });
    await expect(prisma.user.findUnique({ where: { id: created.id } })).resolves.toBeNull();
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});
