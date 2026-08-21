import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getConfig } from "./config.js";

const { databaseUrl: connectionString } = getConfig();

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
