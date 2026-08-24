import { createHash, randomInt } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "../domain/errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MS = 10 * 60 * 1000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export class RateLimitedError extends DomainError {
  constructor(message: string) {
    super("RATE_LIMITED", message);
  }
}

export class InvalidOtpError extends DomainError {
  constructor(message: string) {
    super("INVALID_OTP", message);
  }
}

/**
 * Mobile OTP authentication (customer/partner). No live SMS gateway is
 * integrated (Business Rules Matrix §8 #10 — payment/bank/gateway
 * integrations are explicitly left to a future, CEO-approved choice); in
 * development/test, OTP_DEV_STATIC_CODE is used as a fixed code so the flow
 * is testable end-to-end without a real SMS provider. Swapping in a real
 * provider means implementing `sendSms()` — nothing else in the auth flow
 * changes.
 */
export class OtpService {
  private async sendSms(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[dev] OTP for ${phone}: ${code}`);
      return;
    }
    throw new DomainError(
      "SMS_PROVIDER_NOT_CONFIGURED",
      "No SMS gateway is configured. Business Rules Matrix §8 #10 leaves the exact gateway choice to the CEO."
    );
  }

  async requestOtp(tx: Tx, phone: string, purpose: "LOGIN" | "VERIFY_PHONE", ipAddress?: string) {
    const windowStart = new Date(Date.now() - REQUEST_WINDOW_MS);
    const recentCount = await tx.otpChallenge.count({
      where: { phone, purpose, createdAt: { gte: windowStart } },
    });
    if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
      throw new RateLimitedError(`Too many OTP requests for ${phone}; try again later`);
    }

    const code =
      process.env.NODE_ENV !== "production" && process.env.OTP_DEV_STATIC_CODE
        ? process.env.OTP_DEV_STATIC_CODE
        : String(randomInt(100000, 999999));

    const challenge = await tx.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        ipAddress,
      },
    });

    await this.sendSms(phone, code);
    return { challengeId: challenge.id, expiresAt: challenge.expiresAt };
  }

  async verifyOtp(tx: Tx, phone: string, purpose: "LOGIN" | "VERIFY_PHONE", code: string) {
    const challenge = await tx.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) throw new InvalidOtpError("No pending OTP challenge for this phone");
    if (challenge.expiresAt < new Date()) throw new InvalidOtpError("OTP has expired");
    if (challenge.attempts >= MAX_ATTEMPTS) throw new InvalidOtpError("Too many failed attempts; request a new OTP");

    if (hashCode(code) !== challenge.codeHash) {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new InvalidOtpError("Incorrect OTP");
    }

    await tx.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    return true;
  }
}

export const otpService = new OtpService();
