import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("PostgreSQL integration", () => {
  let container: StartedPostgreSqlContainer;
  let testPrisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const connectionString = container.getConnectionUri();

    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
      stdio: "pipe",
    });

    testPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }, 60_000);

  afterAll(async () => {
    await testPrisma?.$disconnect();
    await container?.stop();
  });

  it("applies the Prisma schema to an isolated PostgreSQL database", async () => {
    await testPrisma.organization.create({
      data: {
        id: "workspace-a",
        name: "Workspace A",
        slug: "workspace-a",
      },
    });

    await expect(testPrisma.organization.count()).resolves.toBe(1);
  });
});
