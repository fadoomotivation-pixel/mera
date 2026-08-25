import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { otpService } from "../auth/otp.service.js";
import { tokenService } from "../auth/token.service.js";
import { passwordService } from "../auth/password.service.js";
import { PermissionDeniedError, UnauthenticatedError } from "../domain/errors.js";

const REFRESH_COOKIE = "mm_refresh";

/* The web app and the API are separate deployments on separate sites —
 * meramakan.com and mera-api.vercel.app — so the refresh cookie is a
 * cross-site cookie.
 *
 * SameSite=Strict means the browser never attaches it to a cross-site
 * request, so /auth/refresh would see no cookie at all and every session
 * would still end after fifteen minutes, with nothing in the logs to
 * explain it. None is what a split origin requires, and browsers only
 * accept None together with Secure — which rules it out for plain-http
 * local development, hence the branch.
 *
 * SameSite=None does mean the cookie rides along on cross-site requests, so
 * the origin allowlist in app.ts is what stops another site from calling
 * /auth/refresh and reading the token out of the response. The two changes
 * go together; neither is safe alone. */
const CROSS_SITE = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: CROSS_SITE,
  sameSite: CROSS_SITE ? ("none" as const) : ("lax" as const),
  path: "/",
};

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
    reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    reply.send({ accessToken, role: user.role });
  });

  app.post("/password/login", async (req, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    // customer/partner are included because the access token must carry the
    // scope id. Without it every customer route filtered on `undefined`, and
    // Prisma treats an undefined filter as no filter — one customer was served
    // every customer's bookings. The OTP and refresh paths always included it;
    // this path, the only one anyone actually uses (there is no SMS gateway),
    // did not.
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { customer: true, partner: true },
    });
    if (!user?.passwordHash || user.status !== "ACTIVE") throw new PermissionDeniedError("Invalid credentials");
    const ok = await passwordService.verify(user.passwordHash, body.password);
    if (!ok) throw new PermissionDeniedError("Invalid credentials");

    if (user.twoFactorEnabled) {
      // Deliberately scope-free: this token only authorises /2fa/verify, and
      // handing out the scope before the second factor would make the first
      // factor sufficient.
      const pendingToken = tokenService.signAccessToken({ sub: user.id, role: user.role });
      reply.send({ pendingTwoFactorToken: pendingToken });
      return;
    }

    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      customerId: user.customer?.id,
      partnerId: user.partner?.id,
    });
    const refreshToken = await prisma.$transaction((tx) => tokenService.issueRefreshToken(tx, user.id, undefined, req.ip));
    reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    reply.send({ accessToken, role: user.role });
  });

  app.post("/2fa/verify", async (req, reply) => {
    const body = z.object({ pendingTwoFactorToken: z.string(), totpCode: z.string().min(6) }).parse(req.body);
    const claims = tokenService.verifyAccessToken(body.pendingTwoFactorToken);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: claims.sub },
      include: { customer: true, partner: true },
    });
    if (!user.twoFactorSecret || !passwordService.verifyTotp(user.twoFactorSecret, body.totpCode)) {
      throw new PermissionDeniedError("Invalid 2FA code");
    }
    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      customerId: user.customer?.id,
      partnerId: user.partner?.id,
    });
    const refreshToken = await prisma.$transaction((tx) => tokenService.issueRefreshToken(tx, user.id, undefined, req.ip));
    reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    reply.send({ accessToken, role: user.role });
  });

  app.post("/refresh", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw new UnauthenticatedError("No refresh token presented");
    const rotated = await prisma.$transaction((tx) => tokenService.rotateRefreshToken(tx, raw, undefined, req.ip));
    if (!rotated) throw new UnauthenticatedError("Refresh token invalid or expired");
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
    reply.setCookie(REFRESH_COOKIE, rotated.newRaw, REFRESH_COOKIE_OPTIONS);
    reply.send({ accessToken });
  });

  app.post("/logout", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) await prisma.$transaction((tx) => tokenService.revokeRefreshToken(tx, raw));
    reply.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    reply.send({ ok: true });
  });
}
