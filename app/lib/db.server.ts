import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

let prisma: PrismaClient;

export function getDB(d1: D1Database): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaD1(d1);
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
