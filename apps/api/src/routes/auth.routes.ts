import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { otpService } from "../auth/otp.service.js";
import { tokenService } from "../auth/token.service.js";
import { passwordService } from "../auth/password.service.js";
import { PermissionDeniedError } from "../domain/errors.js";

const REFRESH_COOKIE = "mm_refresh";

export async function authRoutes(app: FastifyInstance) {
  app.post("/otp/request", async (req, reply) => {
    const body = z.object({ phone: z.string().min(6), purpose: z.enum(["LOGIN", "VERIFY_PHONE"]) }).parse(req.body);
    const result = await prisma.$transaction((tx) => otpService.requestOtp(tx, body.phone, body.purpose, req.ip));
    reply.send({ challengeId: result.challengeId, expiresAt: result.expiresAt });
  });

  app.post("/otp/verify", async (req, reply) => {
    const body = z.object({ phone: z.string().min(6), code: z.string().min(4) }).parse(req.body);
    await prisma.$transaction((tx) => otpService.verifyOtp(tx, body.phone, "LOGIN", body.code));

    const user = await prisma.user.findUnique({
      where: { phone: body.phone },
      include: { customer: true, partner: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new PermissionDeniedError("No active account for this phone number");
    }

    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      customerId: user.customer?.id,
      partnerId: user.partner?.id,
    });
    const refreshToken = await prisma.$transaction((tx) =>
      tokenService.issueRefreshToken(tx, user.id, req.headers["x-device-id"] as string | undefined, req.ip, req.headers["user-agent"])
    );
    reply.setCookie(REFRESH_COOKIE, refreshToken, { httpOnly: true, sameSite: "strict", path: "/" });
    reply.send({ accessToken, role: user.role });
  });

  app.post("/password/login", async (req, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.passwordHash || user.status !== "ACTIVE") throw new PermissionDeniedError("Invalid credentials");
    const ok = await passwordService.verify(user.passwordHash, body.password);
    if (!ok) throw new PermissionDeniedError("Invalid credentials");

    if (user.twoFactorEnabled) {
      const pendingToken = tokenService.signAccessToken({ sub: user.id, role: user.role });
      reply.send({ pendingTwoFactorToken: pendingToken });
      return;
    }

    const accessToken = tokenService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await prisma.$transaction((tx) => tokenService.issueRefreshToken(tx, user.id, undefined, req.ip));
    reply.setCookie(REFRESH_COOKIE, refreshToken, { httpOnly: true, sameSite: "strict", path: "/" });
    reply.send({ accessToken, role: user.role });
  });

  app.post("/2fa/verify", async (req, reply) => {
    const body = z.object({ pendingTwoFactorToken: z.string(), totpCode: z.string().min(6) }).parse(req.body);
    const claims = tokenService.verifyAccessToken(body.pendingTwoFactorToken);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: claims.sub } });
    if (!user.twoFactorSecret || !passwordService.verifyTotp(user.twoFactorSecret, body.totpCode)) {
      throw new PermissionDeniedError("Invalid 2FA code");
    }
    const accessToken = tokenService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await prisma.$transaction((tx) => tokenService.issueRefreshToken(tx, user.id, undefined, req.ip));
    reply.setCookie(REFRESH_COOKIE, refreshToken, { httpOnly: true, sameSite: "strict", path: "/" });
    reply.send({ accessToken, role: user.role });
  });

  app.post("/refresh", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw new PermissionDeniedError("No refresh token presented");
    const rotated = await prisma.$transaction((tx) => tokenService.rotateRefreshToken(tx, raw, undefined, req.ip));
    if (!rotated) throw new PermissionDeniedError("Refresh token invalid or expired");
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: rotated.userId },
      include: { customer: true, partner: true },
    });
    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      customerId: user.customer?.id,
      partnerId: user.partner?.id,
    });
    reply.setCookie(REFRESH_COOKIE, rotated.newRaw, { httpOnly: true, sameSite: "strict", path: "/" });
    reply.send({ accessToken });
  });

  app.post("/logout", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) await prisma.$transaction((tx) => tokenService.revokeRefreshToken(tx, raw));
    reply.clearCookie(REFRESH_COOKIE, { path: "/" });
    reply.send({ ok: true });
  });
}
