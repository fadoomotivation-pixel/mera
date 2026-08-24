import { randomBytes, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Prisma, PrismaClient, UserRole } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenClaims {
  sub: string; // userId
  role: UserRole;
  customerId?: string;
  partnerId?: string;
}

function accessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET is not set");
  return s;
}

export class TokenService {
  signAccessToken(claims: AccessTokenClaims): string {
    return jwt.sign(claims, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return jwt.verify(token, accessSecret()) as AccessTokenClaims;
  }

  /** Issues a new opaque refresh token, storing only its hash (never the raw
   * value) so a DB read alone can never be replayed as a live token. */
  async issueRefreshToken(tx: Tx, userId: string, deviceId?: string, ipAddress?: string, userAgent?: string) {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return raw;
  }

  /** Rotation: verifies the presented refresh token, revokes it, and issues a
   * brand new one — so a stolen-then-reused old token is detectable (it will
   * already be revoked) and cannot be replayed indefinitely. */
  async rotateRefreshToken(tx: Tx, rawToken: string, deviceId?: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      return null;
    }
    await tx.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    const newRaw = await this.issueRefreshToken(tx, existing.userId, deviceId, ipAddress, userAgent);
    return { userId: existing.userId, newRaw };
  }

  async revokeRefreshToken(tx: Tx, rawToken: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await tx.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

export const tokenService = new TokenService();
