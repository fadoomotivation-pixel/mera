import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { passwordService } from "../src/auth/password.service.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot } from "./factories.js";
import { bookingService } from "../src/domain/booking.service.js";

/**
 * Isolation across the login → route seam.
 *
 * The existing RBAC tests mint a token directly with `signAccessToken` and
 * check the routes honour it. That is the right test for the routes, and it
 * passed the whole time this bug was live — because the bug was not in a
 * route. It was in the seam: `/auth/password/login` issued a token with no
 * `customerId` claim, the route filtered on `where: { customerId: undefined }`,
 * and Prisma reads an undefined filter as *no filter at all*. One customer was
 * served every customer's bookings.
 *
 * So these tests log in over HTTP the way a real person does, and assert on
 * what comes back. Nothing here constructs a token by hand.
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

/** Signs in over HTTP and returns the access token — deliberately the same
 * path the web client uses. */
async function signIn(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/password/login",
    payload: { email, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.accessToken, "login returned no access token").toBeTruthy();
  return body.accessToken as string;
}

async function bookPlotFor(customerId: string, partnerId?: string) {
  const { plot } = await makeProjectAndPlot();
  return prisma.$transaction((tx) =>
    bookingService.createDraft(tx, { plotId: plot.id, customerId, partnerId })
  );
}

/** Gives an existing user an email + password so they can use the password
 * login path. */
async function withPassword(userId: string, email: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { email, passwordHash: await passwordService.hash(PASSWORD) },
  });
}

describe("Tenant isolation through the real login path", () => {
  it("serves a customer only their own bookings, never another customer's", async () => {
    const mine = await makeCustomerUser();
    const theirs = await makeCustomerUser();
    await withPassword(mine.user.id, `mine-${Date.now()}@meramakan.test`);

    const myBooking = await bookPlotFor(mine.customer.id);
    const theirBooking = await bookPlotFor(theirs.customer.id);

    const token = await signIn((await prisma.user.findUniqueOrThrow({ where: { id: mine.user.id } })).email!);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customer/bookings",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((b: { id: string }) => b.id);
    expect(ids).toContain(myBooking.id);
    // The assertion that fails loudly if the scope filter ever goes missing
    // again: the other customer's booking must not be in the response.
    expect(ids).not.toContain(theirBooking.id);
    expect(ids).toHaveLength(1);
  });

  it("404s a customer reading another customer's booking by id", async () => {
    const mine = await makeCustomerUser();
    const theirs = await makeCustomerUser();
    await withPassword(mine.user.id, `mine2-${Date.now()}@meramakan.test`);
    const theirBooking = await bookPlotFor(theirs.customer.id);

    const token = await signIn((await prisma.user.findUniqueOrThrow({ where: { id: mine.user.id } })).email!);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/customer/bookings/${theirBooking.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    // 404 rather than 403 — a 403 would confirm the booking exists.
    expect(res.statusCode).toBe(404);
  });

  it("serves a partner only their own referred bookings", async () => {
    const mine = await makePartnerUser();
    const theirs = await makePartnerUser();
    const customer = await makeCustomerUser();
    await withPassword(mine.user.id, `partner-${Date.now()}@meramakan.test`);

    const myBooking = await bookPlotFor(customer.customer.id, mine.partner.id);
    const theirBooking = await bookPlotFor(customer.customer.id, theirs.partner.id);

    const token = await signIn((await prisma.user.findUniqueOrThrow({ where: { id: mine.user.id } })).email!);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/partner/referrals",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((r: { booking: { id: string } }) => r.booking.id);
    expect(ids).toContain(myBooking.id);
    expect(ids).not.toContain(theirBooking.id);
  });

  it("issues a customer token that actually carries the customer scope", async () => {
    const { user, customer } = await makeCustomerUser();
    await withPassword(user.id, `scope-${Date.now()}@meramakan.test`);
    const token = await signIn((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email!);

    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    expect(payload.customerId).toBe(customer.id);
  });

  it("issues a partner token that actually carries the partner scope", async () => {
    const { user, partner } = await makePartnerUser();
    await withPassword(user.id, `pscope-${Date.now()}@meramakan.test`);
    const token = await signIn((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email!);

    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    expect(payload.partnerId).toBe(partner.id);
  });

  it("refuses a scope-free token rather than answering with everyone's data", async () => {
    // Simulates exactly the old broken token: authenticated, correct role, no
    // scope claim. Before the fix this returned every customer's bookings;
    // now it must be refused.
    const { user } = await makeCustomerUser();
    const other = await makeCustomerUser();
    await bookPlotFor(other.customer.id);

    const { tokenService } = await import("../src/auth/token.service.js");
    const scopeless = tokenService.signAccessToken({ sub: user.id, role: "CUSTOMER" });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customer/bookings",
      headers: { authorization: `Bearer ${scopeless}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
