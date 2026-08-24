import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { tokenService } from "../src/auth/token.service.js";
import { makeAdminUser } from "./factories.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function superAdminToken() {
  const admin = await makeAdminUser("SUPER_ADMIN");
  return tokenService.signAccessToken({ sub: admin.id, role: "SUPER_ADMIN" });
}

describe("Admin-created customer/partner accounts (no SMS gateway)", () => {
  it("creates a customer with email+password and the customer can immediately log in with it", async () => {
    const token = await superAdminToken();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Ravi Kumar", email: "ravi@example.com", password: "Sup3rSecret!", phone: "+919990000099" },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.name).toBe("Ravi Kumar");
    expect(created.user.email).toBe("ravi@example.com");

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password/login",
      payload: { email: "ravi@example.com", password: "Sup3rSecret!" },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().role).toBe("CUSTOMER");
  });

  it("creates a partner with email+password and an auto-generated partner code", async () => {
    const token = await superAdminToken();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/partners",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Anita Sharma", email: "anita@example.com", password: "Sup3rSecret!" },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.partnerCode).toMatch(/^MM-P-/);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password/login",
      payload: { email: "anita@example.com", password: "Sup3rSecret!" },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().role).toBe("CHANNEL_PARTNER");
  });

  it("rejects creating a second account with the same email", async () => {
    const token = await superAdminToken();
    await app.inject({
      method: "POST",
      url: "/api/v1/admin/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Dup One", email: "dup@example.com", password: "Sup3rSecret!" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/admin/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Dup Two", email: "dup@example.com", password: "Sup3rSecret!" },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().error.code).toBe("EMAIL_IN_USE");
  });

  it("rejects a non-admin (customer token) from creating accounts", async () => {
    const customerUser = await prisma.user.create({ data: { role: "CUSTOMER", phone: "+919990000098", status: "ACTIVE" } });
    const token = tokenService.signAccessToken({ sub: customerUser.id, role: "CUSTOMER" });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Should Fail", email: "shouldfail@example.com", password: "Sup3rSecret!" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("SUPPORT can create a customer but not a partner (per permission matrix)", async () => {
    const supportUser = await prisma.user.create({ data: { role: "SUPPORT", email: "support2@test.com", status: "ACTIVE" } });
    const token = tokenService.signAccessToken({ sub: supportUser.id, role: "SUPPORT" });

    const customerRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Support Made Me", email: "supportmade@example.com", password: "Sup3rSecret!" },
    });
    expect(customerRes.statusCode).toBe(201);

    const partnerRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/partners",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Should Fail Partner", email: "shouldfailpartner@example.com", password: "Sup3rSecret!" },
    });
    expect(partnerRes.statusCode).toBe(403);
  });
});
