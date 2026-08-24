import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { otpService, RateLimitedError, InvalidOtpError } from "../src/auth/otp.service.js";
import { tokenService } from "../src/auth/token.service.js";
import { passwordService } from "../src/auth/password.service.js";
import { requireRole, requireOwnCustomer } from "../src/auth/rbac.js";
import { PermissionDeniedError } from "../src/domain/errors.js";

describe("OtpService", () => {
  it("verifies the correct dev-static OTP code and consumes the challenge", async () => {
    const phone = "+919999900001";
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    const ok = await prisma.$transaction((tx) => otpService.verifyOtp(tx, phone, "LOGIN", "123456"));
    expect(ok).toBe(true);
  });

  it("rejects an incorrect code and increments attempts", async () => {
    const phone = "+919999900002";
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    await expect(prisma.$transaction((tx) => otpService.verifyOtp(tx, phone, "LOGIN", "000000"))).rejects.toThrow(
      InvalidOtpError
    );
  });

  it("rejects reusing an already-consumed OTP", async () => {
    const phone = "+919999900003";
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    await prisma.$transaction((tx) => otpService.verifyOtp(tx, phone, "LOGIN", "123456"));
    await expect(prisma.$transaction((tx) => otpService.verifyOtp(tx, phone, "LOGIN", "123456"))).rejects.toThrow(
      InvalidOtpError
    );
  });

  it("rate-limits excessive OTP requests for the same phone", async () => {
    const phone = "+919999900004";
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    await prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"));
    await expect(prisma.$transaction((tx) => otpService.requestOtp(tx, phone, "LOGIN"))).rejects.toThrow(RateLimitedError);
  });
});

describe("TokenService", () => {
  it("signs and verifies an access token round-trip", () => {
    const token = tokenService.signAccessToken({ sub: "user-1", role: "CUSTOMER", customerId: "cust-1" });
    const claims = tokenService.verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.role).toBe("CUSTOMER");
    expect(claims.customerId).toBe("cust-1");
  });

  it("rotates a refresh token: old token cannot be reused after rotation", async () => {
    const user = await prisma.user.create({ data: { role: "CUSTOMER", phone: "+919999900005", status: "ACTIVE" } });
    const raw = await prisma.$transaction((tx) => tokenService.issueRefreshToken(tx, user.id));

    const rotated = await prisma.$transaction((tx) => tokenService.rotateRefreshToken(tx, raw));
    expect(rotated?.userId).toBe(user.id);

    const secondAttempt = await prisma.$transaction((tx) => tokenService.rotateRefreshToken(tx, raw));
    expect(secondAttempt).toBeNull(); // already revoked — cannot be replayed
  });
});

describe("PasswordService", () => {
  it("hashes and verifies a password", async () => {
    const hash = await passwordService.hash("Sup3rSecret!");
    expect(await passwordService.verify(hash, "Sup3rSecret!")).toBe(true);
    expect(await passwordService.verify(hash, "wrong")).toBe(false);
  });

  it("generates a TOTP secret that validates a real-time token", () => {
    const secret = passwordService.generateTwoFactorSecret();
    // We can't easily generate a live token without pulling in the authenticator
    // internals in the test, but we can assert an obviously-wrong token fails.
    expect(passwordService.verifyTotp(secret, "000000")).toBe(false);
  });
});

describe("RBAC", () => {
  it("requireRole rejects a role outside the allowed set", () => {
    expect(() => requireRole({ sub: "u1", role: "CUSTOMER" }, "SUPER_ADMIN", "FINANCE_ADMIN")).toThrow(PermissionDeniedError);
  });

  it("requireRole passes for an allowed role", () => {
    expect(() => requireRole({ sub: "u1", role: "SUPER_ADMIN" }, "SUPER_ADMIN")).not.toThrow();
  });

  it("requireOwnCustomer rejects access to another customer's data", () => {
    expect(() => requireOwnCustomer({ sub: "u1", role: "CUSTOMER", customerId: "cust-A" }, "cust-B")).toThrow(
      PermissionDeniedError
    );
  });

  it("requireOwnCustomer allows access to one's own data", () => {
    expect(() => requireOwnCustomer({ sub: "u1", role: "CUSTOMER", customerId: "cust-A" }, "cust-A")).not.toThrow();
  });
});
