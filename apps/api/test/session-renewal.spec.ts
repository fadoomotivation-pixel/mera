import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp, isAllowedOrigin } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { passwordService } from "../src/auth/password.service.js";
import { makeCustomerUser } from "./factories.js";

/**
 * Session renewal.
 *
 * The access token lasts 15 minutes and the refresh token 30 days. The
 * renewal path existed and was correct from the start — it just had no
 * caller, so in practice every session ended after fifteen minutes with
 * "Invalid or expired access token" on screen. These tests cover the path
 * itself, so it cannot quietly rot again now that the client depends on it.
 */

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const PASSWORD = "TestPassw0rd!";

async function makeLogin() {
  const { user, customer } = await makeCustomerUser();
  const email = `renew-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@meramakan.test`;
  await prisma.user.update({
    where: { id: user.id },
    data: { email, passwordHash: await passwordService.hash(PASSWORD) },
  });
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/password/login",
    payload: { email, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return { customer, res };
}

/** Pulls the refresh cookie value out of a login response. */
function refreshCookie(res: { cookies: { name: string; value: string }[] }): string {
  const c = res.cookies.find((c) => c.name === "mm_refresh");
  expect(c, "login did not set a refresh cookie").toBeTruthy();
  return c!.value;
}

describe("Session renewal", () => {
  it("trades a refresh cookie for a working access token", async () => {
    const { customer, res } = await makeLogin();

    const renewed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { mm_refresh: refreshCookie(res) },
    });

    expect(renewed.statusCode).toBe(200);
    const token = renewed.json().accessToken as string;
    expect(token).toBeTruthy();

    // The renewed token must carry the scope, or the client would silently
    // recover from expiry straight into the data-isolation bug.
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    expect(payload.customerId).toBe(customer.id);

    // And it must actually work on a scoped route.
    const use = await app.inject({
      method: "GET",
      url: "/api/v1/customer/bookings",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(use.statusCode).toBe(200);
  });

  it("rotates the refresh token, and refuses the old one", async () => {
    const { res } = await makeLogin();
    const first = refreshCookie(res);

    const a = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", cookies: { mm_refresh: first } });
    expect(a.statusCode).toBe(200);
    const second = refreshCookie(a);
    expect(second).not.toBe(first);

    // Replaying the consumed token must fail — that is what makes theft of an
    // old cookie detectable rather than indefinitely useful.
    const replay = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", cookies: { mm_refresh: first } });
    expect(replay.statusCode).toBe(401);
  });

  it("refuses renewal after logout", async () => {
    const { res } = await makeLogin();
    const cookie = refreshCookie(res);

    await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies: { mm_refresh: cookie } });

    const after = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", cookies: { mm_refresh: cookie } });
    expect(after.statusCode).toBe(401);
  });

  it("refuses renewal with no cookie at all", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/refresh" });
    expect(res.statusCode).toBe(401);
  });

  it("sets a cross-site-capable cookie so the browser will actually send it back", async () => {
    // SameSite=Strict silently breaks the whole flow when the web app and the
    // API are on different sites: the browser simply omits the cookie and the
    // server sees an anonymous request. Assert on the header text because that
    // is what the browser reads.
    const { res } = await makeLogin();
    const header = String(res.headers["set-cookie"]);
    expect(header).toContain("mm_refresh=");
    expect(header).toContain("HttpOnly");
    expect(header).not.toContain("SameSite=Strict");
  });
});

describe("CORS origin allowlist", () => {
  it("allows the production domains", () => {
    expect(isAllowedOrigin("https://meramakan.com")).toBe(true);
    expect(isAllowedOrigin("https://www.meramakan.com")).toBe(true);
  });

  it("allows this account's preview deployments", () => {
    expect(isAllowedOrigin("https://mera-95g3jhrgh-fadoomotivation-pixels-projects.vercel.app")).toBe(true);
  });

  it("allows local development", () => {
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
  });

  it("allows a request with no Origin header", () => {
    // curl, health checks, server-to-server. Not a browser cross-site call.
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it("refuses everything else", () => {
    // The point of the allowlist: with SameSite=None the refresh cookie now
    // travels cross-site, so a reflected origin would let any page call
    // /auth/refresh and read a live access token out of the response.
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("https://meramakan.com.evil.example")).toBe(false);
    expect(isAllowedOrigin("http://meramakan.com")).toBe(false);
    // A look-alike that ends with the right words but is not the right host.
    expect(isAllowedOrigin("https://evil-fadoomotivation-pixels-projects.vercel.app.evil.example")).toBe(false);
  });
});
