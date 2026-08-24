import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { tokenService } from "../src/auth/token.service.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot, makeAdminUser } from "./factories.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("RBAC — server-side enforcement (docs/05-permission-matrix.md)", () => {
  it("rejects an admin route with no token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/dashboard" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("PERMISSION_DENIED");
  });

  it("rejects an admin route when called with a CUSTOMER token", async () => {
    const { user } = await makeCustomerUser();
    const token = tokenService.signAccessToken({ sub: user.id, role: "CUSTOMER" });
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/dashboard", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a partner route when called with a CUSTOMER token", async () => {
    const { user } = await makeCustomerUser();
    const token = tokenService.signAccessToken({ sub: user.id, role: "CUSTOMER" });
    const res = await app.inject({ method: "GET", url: "/api/v1/partner/dashboard", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it("allows a customer to read their own booking", async () => {
    const { user, customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction((tx) => bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id }));
    const token = tokenService.signAccessToken({ sub: user.id, role: "CUSTOMER", customerId: customer.id });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/customer/bookings/${booking.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(booking.id);
  });

  it("404s (not 403/200) when a customer requests another customer's booking by ID", async () => {
    const { customer: ownerCustomer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction((tx) =>
      bookingService.createDraft(tx, { plotId: plot.id, customerId: ownerCustomer.id })
    );

    const { user: attackerUser, customer: attackerCustomer } = await makeCustomerUser();
    const token = tokenService.signAccessToken({ sub: attackerUser.id, role: "CUSTOMER", customerId: attackerCustomer.id });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/customer/bookings/${booking.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("a partner cannot see another partner's referral list via the same endpoint (query is scoped by token, not a param)", async () => {
    const { partner: p1 } = await makePartnerUser();
    const { partner: p2 } = await makePartnerUser();
    const { customer } = await makeCustomerUser();
    const { plot: plot1 } = await makeProjectAndPlot();
    const { plot: plot2 } = await makeProjectAndPlot();
    await prisma.$transaction((tx) => bookingService.createDraft(tx, { plotId: plot1.id, customerId: customer.id, partnerId: p1.id }));
    await prisma.$transaction((tx) => bookingService.createDraft(tx, { plotId: plot2.id, customerId: customer.id, partnerId: p2.id }));

    const { user: p1User } = await prisma.channelPartner
      .findUniqueOrThrow({ where: { id: p1.id } })
      .then(async (p) => ({ user: await prisma.user.findUniqueOrThrow({ where: { id: p.userId } }) }));
    const token = tokenService.signAccessToken({ sub: p1User.id, role: "CHANNEL_PARTNER", partnerId: p1.id });

    const res = await app.inject({ method: "GET", url: "/api/v1/partner/referrals", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ booking: { partnerId: string } }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.booking.partnerId).toBe(p1.id);
  });

  it("allows COMPLIANCE_AUDIT to read audit logs but the endpoint is closed to SUPPORT", async () => {
    const auditUser = await makeAdminUser("SUPER_ADMIN"); // reuse factory; role overridden below
    const complianceUser = await prisma.user.create({ data: { role: "COMPLIANCE_AUDIT", email: "audit@test.com", status: "ACTIVE" } });
    const supportUser = await prisma.user.create({ data: { role: "SUPPORT", email: "support@test.com", status: "ACTIVE" } });
    void auditUser;

    const complianceToken = tokenService.signAccessToken({ sub: complianceUser.id, role: "COMPLIANCE_AUDIT" });
    const supportToken = tokenService.signAccessToken({ sub: supportUser.id, role: "SUPPORT" });

    const okRes = await app.inject({ method: "GET", url: "/api/v1/admin/audit-logs", headers: { authorization: `Bearer ${complianceToken}` } });
    expect(okRes.statusCode).toBe(200);

    const deniedRes = await app.inject({ method: "GET", url: "/api/v1/admin/audit-logs", headers: { authorization: `Bearer ${supportToken}` } });
    expect(deniedRes.statusCode).toBe(403);
  });

  it("public lead capture works without any auth token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/public/leads",
      payload: { name: "Test Lead", phone: "9876500000", source: "DIRECT", consentGiven: true },
    });
    expect(res.statusCode).toBe(201);
  });
});
