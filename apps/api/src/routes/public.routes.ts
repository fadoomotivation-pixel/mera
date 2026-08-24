import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { serializeBigInts } from "../lib/serialize.js";

const leadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  preferredProjectId: z.string().uuid().optional(),
  preferredPlotSize: z.string().optional(),
  preferredVisitDate: z.string().datetime().optional(),
  message: z.string().optional(),
  source: z.enum(["META_ADS", "GOOGLE_ADS", "WHATSAPP", "DIRECT", "REFERRAL", "OTHER"]),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  consentGiven: z.boolean(),
});

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "").replace(/^0+/, "");
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/projects", async (_req, reply) => {
    const projects = await prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        description: true,
        hasRoads: true,
        hasElectricity: true,
        hasWater: true,
        hasPark: true,
        hasMarket: true,
        hasGuestHouse: true,
      },
    });
    reply.send(serializeBigInts(projects));
  });

  app.get("/projects/:slug/availability", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const counts = await prisma.plot.groupBy({
      by: ["status"],
      where: { projectId: project.id },
      _count: true,
    });
    reply.send({ project: project.name, availability: counts });
  });

  app.post("/leads", async (req, reply) => {
    const body = leadSchema.parse(req.body);
    const dedupeKey = normalizePhone(body.phone);

    // Intelligent dedupe: if a lead with this phone already exists in the
    // last 30 days, do not create a fresh row — link to the existing one.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingLead = await prisma.lead.findFirst({
      where: { dedupeKey, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
    const existingCustomer = await prisma.user.findFirst({ where: { phone: body.phone, role: "CUSTOMER" } });

    if (existingLead) {
      reply.send({ leadId: existingLead.id, status: "DUPLICATE_LINKED" });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        name: body.name,
        phone: body.phone,
        dedupeKey,
        source: body.source,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        preferredProjectId: body.preferredProjectId,
        preferredPlotSize: body.preferredPlotSize,
        preferredVisitDate: body.preferredVisitDate ? new Date(body.preferredVisitDate) : undefined,
        message: body.message,
        consentGiven: body.consentGiven,
        consentAt: body.consentGiven ? new Date() : undefined,
        convertedCustomerId: existingCustomer ? existingCustomer.id : undefined,
        status: "NEW",
      },
    });
    reply.status(201).send({ leadId: lead.id, status: "CREATED" });
  });
}
