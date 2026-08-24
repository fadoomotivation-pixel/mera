import argon2 from "argon2";
import { authenticator } from "otplib";

/** Admin-only password + optional TOTP 2FA. Customers/partners authenticate
 * via OTP (see otp.service.ts); password+2FA are also available to them as
 * an optional secondary auth method per the spec, using this same module. */
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateTwoFactorSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(secret: string, accountEmail: string): string {
    return authenticator.keyuri(accountEmail, "MERA MAKAN", secret);
  }

  verifyTotp(secret: string, token: string): boolean {
    return authenticator.verify({ token, secret });
  }
}

export const passwordService = new PasswordService();
