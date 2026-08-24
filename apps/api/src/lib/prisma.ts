import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. Domain services accept a `tx` (transaction
// client) parameter so they can be composed inside one `prisma.$transaction`
// call when a workflow spans multiple services (e.g. Booking reaching
// FULLY_COLLECTED fans out to Referral + Royalty + Reward + ROI checks).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
