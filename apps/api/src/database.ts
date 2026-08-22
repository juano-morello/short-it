import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getConfig } from "./config.js";

const { databaseUrl: connectionString } = getConfig();

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

export const analyticsPool = new Pool({ connectionString, max: 2 });

export const analyticsPrisma = new PrismaClient({
  adapter: new PrismaPg(analyticsPool),
});
