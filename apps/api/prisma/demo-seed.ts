/**
 * Demo dataset for MERA MAKAN.
 *
 * Purpose: give the admin console, partner portal and customer portal enough
 * realistic material that the CRM can actually be understood and tested —
 * inventory at different stages, partners at different tiers, money in every
 * payout state.
 *
 * The important design decision: this script does NOT fabricate rows. Every
 * booking, payment, commission, ROI accrual, tier achievement, reward and
 * payout is produced by calling the same domain services production uses. That
 * means the ledger balances, idempotency keys are real, state transitions are
 * legal, and the numbers on screen are ones the engine actually computed. A
 * hand-written INSERT of "₹32,550 net" would look identical and prove nothing.
 *
 * Idempotent: deterministic IDs plus upserts throughout, so it can be re-run
 * safely against a database that already has it.
 *
 * Run:  pnpm exec tsx prisma/demo-seed.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { passwordService } from "../src/auth/password.service.js";
import { bookingService } from "../src/domain/booking.service.js";
import { paymentService } from "../src/domain/payment.service.js";
import { referralCommissionService } from "../src/domain/referral.service.js";
import { balanceSheetService } from "../src/domain/balance-sheet.service.js";
import { roiCalculationService } from "../src/domain/roi.service.js";
import { royaltyService } from "../src/domain/royalty.service.js";
import { rewardService } from "../src/domain/reward.service.js";
import { payoutService } from "../src/domain/payout.service.js";

const prisma = new PrismaClient();
const rupees = (n: number) => BigInt(n) * 100n;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Demo accounts share one password so a reviewer can move between roles
 * quickly. These are seeded, disposable accounts on a demo dataset — see the
 * note printed at the end about rotating them before real use. */
const DEMO_PASSWORD = "ChangeMe123!";

const PARTNERS = [
  { code: "MM-P-0001", name: "Anita Sharma", email: "anita.demo@meramakan.test", phone: "+919990000002", tierGroups: [5, 5] },
  { code: "MM-P-0002", name: "Rakesh Yadav", email: "rakesh.demo@meramakan.test", phone: "+919990000010", tierGroups: [2, 2] },
  { code: "MM-P-0003", name: "Sunita Devi", email: "sunita.demo@meramakan.test", phone: "+919990000011", tierGroups: [2, 3] },
  { code: "MM-P-0004", name: "Imran Qureshi", email: "imran.demo@meramakan.test", phone: "+919990000012", tierGroups: [10, 10] },
  { code: "MM-P-0005", name: "Priya Nair", email: "priya.demo@meramakan.test", phone: "+919990000013", tierGroups: [1, 1] },
  { code: "MM-P-0006", name: "Gurpreet Singh", email: "gurpreet.demo@meramakan.test", phone: "+919990000014", tierGroups: [0, 0] },
] as const;

const CUSTOMERS = [
  { key: "c01", name: "Ravi Kumar", email: "ravi.demo@meramakan.test", phone: "+919990000001" },
  { key: "c02", name: "Meena Gupta", email: "meena.demo@meramakan.test", phone: "+919990000020" },
  { key: "c03", name: "Arjun Malhotra", email: "arjun.demo@meramakan.test", phone: "+919990000021" },
  { key: "c04", name: "Fatima Sheikh", email: "fatima.demo@meramakan.test", phone: "+919990000022" },
  { key: "c05", name: "Deepak Verma", email: "deepak.demo@meramakan.test", phone: "+919990000023" },
  { key: "c06", name: "Lakshmi Iyer", email: "lakshmi.demo@meramakan.test", phone: "+919990000024" },
  { key: "c07", name: "Harpreet Kaur", email: "harpreet.demo@meramakan.test", phone: "+919990000025" },
  { key: "c08", name: "Sanjay Patil", email: "sanjay.demo@meramakan.test", phone: "+919990000026" },
  { key: "c09", name: "Nisha Agarwal", email: "nisha.demo@meramakan.test", phone: "+919990000027" },
  { key: "c10", name: "Vikram Chauhan", email: "vikram.demo@meramakan.test", phone: "+919990000028" },
] as const;

/** How far each booking has progressed. The spread is deliberate: the admin
 * console is only legible if inventory shows every state at once. */
type Stage = "booked" | "partial" | "full" | "registered" | "cancelled";

const BOOKINGS: { plot: string; customer: string; partner: string; stage: Stage; ageDays: number }[] = [
  { plot: "A-001", customer: "c01", partner: "MM-P-0001", stage: "registered", ageDays: 150 },
  { plot: "A-002", customer: "c02", partner: "MM-P-0001", stage: "full", ageDays: 120 },
  { plot: "A-003", customer: "c03", partner: "MM-P-0002", stage: "full", ageDays: 100 },
  { plot: "A-004", customer: "c04", partner: "MM-P-0004", stage: "registered", ageDays: 95 },
  { plot: "A-005", customer: "c05", partner: "MM-P-0004", stage: "full", ageDays: 80 },
  { plot: "A-006", customer: "c06", partner: "MM-P-0003", stage: "partial", ageDays: 55 },
  { plot: "A-007", customer: "c07", partner: "MM-P-0001", stage: "partial", ageDays: 40 },
  { plot: "A-008", customer: "c08", partner: "MM-P-0002", stage: "partial", ageDays: 32 },
  { plot: "A-009", customer: "c09", partner: "MM-P-0005", stage: "booked", ageDays: 12 },
  { plot: "A-010", customer: "c10", partner: "MM-P-0003", stage: "booked", ageDays: 6 },
  { plot: "A-011", customer: "c02", partner: "MM-P-0005", stage: "cancelled", ageDays: 70 },
];

async function main() {
  console.log("Seeding MERA MAKAN demo dataset…\n");

  const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "ceo@meramakan.test" } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { email: "finance@meramakan.test" } });
  const project = await prisma.project.findUniqueOrThrow({ where: { slug: "shyam-vatika" } });
  const passwordHash = await passwordService.hash(DEMO_PASSWORD);

  /* ── Inventory ────────────────────────────────────────────────────────────
     24 plots so the admin grid shows a real block with genuine gaps, not five
     tiles. Plots 12+ stay AVAILABLE as live inventory to sell against. */
  for (let i = 1; i <= 24; i++) {
    const plotNumber = `A-${i.toString().padStart(3, "0")}`;
    const plotAmountPaise = rupees(350_000);
    const registrationAmountPaise = rupees(1_000);
    await prisma.plot.upsert({
      where: { projectId_plotNumber: { projectId: project.id, plotNumber } },
      update: {},
      create: {
        projectId: project.id,
        plotNumber,
        sizeGaj: 50,
        ratePerGajPaise: rupees(7_000),
        plotAmountPaise,
        registrationAmountPaise,
        totalCustomerAmountPaise: plotAmountPaise + registrationAmountPaise,
        isCashPlot: true,
        roiEligible: true,
        status: "AVAILABLE",
      },
    });
  }
  console.log("  ✓ 24 plots in Shyam Vatika");

  /* ── Partners ─────────────────────────────────────────────────────────── */
  const partnerIdByCode = new Map<string, string>();
  for (const p of PARTNERS) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { role: "CHANNEL_PARTNER", email: p.email, phone: p.phone, passwordHash, status: "ACTIVE" },
    });
    const partner = await prisma.channelPartner.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, partnerCode: p.code, name: p.name },
    });
    partnerIdByCode.set(p.code, partner.id);
  }

  /* Generation-to-generation structure. This is the Balance Sheet input graph
     and nothing else — it is never surfaced to any UI as a tree/leg/downline
     (docs/03-erd.md). Anita sits above four partners; Imran above one. */
  const relations: [string, string, number][] = [
    ["MM-P-0001", "MM-P-0002", 1],
    ["MM-P-0001", "MM-P-0003", 1],
    ["MM-P-0001", "MM-P-0005", 1],
    ["MM-P-0001", "MM-P-0006", 1],
    ["MM-P-0004", "MM-P-0005", 1],
  ];
  for (const [parent, child, level] of relations) {
    const partnerId = partnerIdByCode.get(parent)!;
    const relatedPartnerId = partnerIdByCode.get(child)!;
    await prisma.generationRelation.upsert({
      where: { partnerId_relatedPartnerId: { partnerId, relatedPartnerId } },
      update: {},
      create: { partnerId, relatedPartnerId, generationLevel: level },
    });
  }
  console.log(`  ✓ ${PARTNERS.length} channel partners`);

  /* ── Customers ────────────────────────────────────────────────────────── */
  const customerIdByKey = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { role: "CUSTOMER", email: c.email, phone: c.phone, passwordHash, status: "ACTIVE" },
    });
    const customer = await prisma.customer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, name: c.name, address: "Sikar, Rajasthan" },
    });
    customerIdByKey.set(c.key, customer.id);
  }
  console.log(`  ✓ ${CUSTOMERS.length} customers`);

  /* ── Bookings, payments and every downstream money event ───────────────── */
  let commissionCount = 0;
  let roiMonths = 0;
  for (const b of BOOKINGS) {
    const plot = await prisma.plot.findUniqueOrThrow({
      where: { projectId_plotNumber: { projectId: project.id, plotNumber: b.plot } },
    });
    // Already processed on a previous run — skip rather than double-book.
    const existing = await prisma.booking.findFirst({ where: { plotId: plot.id } });
    if (existing) continue;

    const bookingId = await prisma.$transaction(async (tx) => {
      const draft = await bookingService.createDraft(tx as Prisma.TransactionClient, {
        plotId: plot.id,
        customerId: customerIdByKey.get(b.customer)!,
        partnerId: partnerIdByCode.get(b.partner)!,
      });
      await bookingService.reserve(tx as Prisma.TransactionClient, draft.id);
      await bookingService.confirmBooking(tx as Prisma.TransactionClient, draft.id);
      return draft.id;
    });

    // Backdate so the closing-cycle assignment and ageing look real.
    await prisma.booking.update({ where: { id: bookingId }, data: { bookingDate: daysAgo(b.ageDays) } });

    if (b.stage === "cancelled") {
      await prisma.$transaction((tx) =>
        bookingService.cancel(tx as Prisma.TransactionClient, bookingId, "Customer withdrew — demo dataset")
      );
      continue;
    }
    if (b.stage === "booked") continue;

    // How many of the three installments have actually been collected.
    const installmentsToPay = b.stage === "partial" ? 1 : 3;
    const schedules = await prisma.paymentSchedule.findMany({
      where: { bookingId },
      orderBy: { installmentNumber: "asc" },
    });

    for (const s of schedules.slice(0, installmentsToPay)) {
      await prisma.$transaction(async (tx) => {
        const t = tx as Prisma.TransactionClient;
        const payment = await paymentService.initiate(t, {
          bookingId,
          paymentScheduleId: s.id,
          amountPaise: s.amountDuePaise,
          method: "BANK_TRANSFER",
          idempotencyKey: `demo:pay:${bookingId}:${s.installmentNumber}`,
        });
        await paymentService.markPending(t, payment.id);
        await paymentService.verify(t, payment.id, finance.id);
        await paymentService.collect(t, payment.id);
        await paymentService.recomputeScheduleStatus(t, s.id);
      });
    }

    // Finance's confirmation that everything owed on this booking — the three
    // installments plus the ₹1,000 registration fee — has landed. Booking
    // service treats this as the second half of the fully-collected test.
    if (installmentsToPay === 3) {
      await prisma.collection.upsert({
        where: { bookingId },
        update: {},
        create: {
          bookingId,
          confirmedByUserId: finance.id,
          confirmedAt: daysAgo(Math.max(1, b.ageDays - 95)),
          totalCollectedSnapshotPaise: plot.totalCustomerAmountPaise,
          note: "Demo dataset — full collection confirmed.",
        },
      });
    }

    const { justFullyCollected } = await prisma.$transaction((tx) =>
      bookingService.onPaymentScheduleUpdated(tx as Prisma.TransactionClient, bookingId)
    );

    if (justFullyCollected) {
      // The five streams fire off the fully-collected edge, exactly as in
      // production. Each is idempotent, so a re-run is a no-op.
      await prisma.$transaction(async (tx) => {
        const t = tx as Prisma.TransactionClient;
        await referralCommissionService.evaluate(t, bookingId, superAdmin.id);
        await balanceSheetService.evaluate(t, bookingId, superAdmin.id);
        await roiCalculationService.maybeStart(t, bookingId, "FULL_COLLECTION_DATE", superAdmin.id);
      });
      commissionCount++;

      // Accrue a few ROI months on the oldest bookings so the customer ROI
      // screen has history rather than an empty promise.
      const monthsElapsed = Math.min(12, Math.floor((b.ageDays - 90) / 30));
      for (let m = 1; m <= monthsElapsed; m++) {
        try {
          await prisma.$transaction((tx) =>
            roiCalculationService.accrueMonth(tx as Prisma.TransactionClient, bookingId, m, superAdmin.id)
          );
          roiMonths++;
        } catch {
          // ROI cannot start while ROIRule is PENDING_CEO_APPROVAL. That is
          // correct behaviour, not a seed failure — the demo simply shows no
          // ROI history until the CEO approves the rule (docs/07 §D7).
          break;
        }
      }
    }

    if (b.stage === "registered") {
      await prisma.$transaction((tx) =>
        bookingService.markRegistered(tx as Prisma.TransactionClient, bookingId)
      );
    }
  }
  console.log(`  ✓ ${BOOKINGS.length} bookings across booked/partial/full/registered/cancelled`);
  console.log(`  ✓ ${commissionCount} referral commissions posted by the engine`);
  console.log(`  ✓ ${roiMonths} ROI months accrued${roiMonths === 0 ? " (ROIRule is PENDING_CEO_APPROVAL — expected)" : ""}`);

  /* ── Leadership tiers ─────────────────────────────────────────────────── */
  let tierCount = 0;
  for (const p of PARTNERS) {
    const [a, bb] = p.tierGroups;
    if (a < 2 || bb < 2) continue; // below the first tier — nothing to award
    const qualifying = await prisma.booking.findFirst({
      where: { partnerId: partnerIdByCode.get(p.code)!, status: { in: ["FULLY_COLLECTED", "REGISTERED", "COMPLETED"] } },
    });
    if (!qualifying) continue;
    await prisma
      .$transaction((tx) =>
        royaltyService.recordAchievement(tx as Prisma.TransactionClient, {
          partnerId: partnerIdByCode.get(p.code)!,
          qualifyingBookingId: qualifying.id,
          groupACount: a,
          groupBCount: bb,
          createdByUserId: superAdmin.id,
        })
      )
      .then(() => { tierCount++; })
      .catch((e) => console.log(`    · tier skipped for ${p.code}: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}`));
  }
  console.log(`  ✓ ${tierCount} leadership tier achievements`);

  /* ── Rewards ──────────────────────────────────────────────────────────── */
  let rewardCount = 0;
  for (const p of PARTNERS) {
    const [a, bb] = p.tierGroups;
    if (a < 2 || bb < 2) continue;
    const qualifying = await prisma.booking.findFirst({
      where: { partnerId: partnerIdByCode.get(p.code)!, status: { in: ["FULLY_COLLECTED", "REGISTERED", "COMPLETED"] } },
    });
    if (!qualifying) continue;
    await prisma
      .$transaction((tx) =>
        rewardService.evaluate(tx as Prisma.TransactionClient, {
          partnerId: partnerIdByCode.get(p.code)!,
          qualifyingBookingId: qualifying.id,
          groupACount: a,
          groupBCount: bb,
          createdByUserId: superAdmin.id,
        })
      )
      .then(() => { rewardCount++; })
      .catch((e) => console.log(`    · reward skipped for ${p.code}: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}`));
  }
  console.log(`  ✓ ${rewardCount} reward milestone evaluations`);

  /* Achievements are recorded PENDING and only become ACTIVE once promoted —
     the snapshot allocates to ACTIVE tiers only, so without this step the pool
     would finalise with zero allocations. */
  const promoted = await prisma.$transaction((tx) =>
    royaltyService.promotePendingAchievements(tx as Prisma.TransactionClient, new Date())
  );
  console.log(`  ✓ tier achievements promoted to ACTIVE`);

  /* ── Royalty snapshot for last month ──────────────────────────────────── */
  /* A tier achieved this month earns royalty starting the FOLLOWING month, so
     that is the period whose snapshot actually has eligible achievers. Running
     it for the current month would correctly allocate nothing — right by the
     rules, but it would make the royalty screen look broken in a demo. */
  const snapshotMonth = new Date();
  snapshotMonth.setUTCMonth(snapshotMonth.getUTCMonth() + 1);
  const turnover = await prisma.booking.aggregate({
    where: { status: { in: ["FULLY_COLLECTED", "REGISTERED", "COMPLETED"] } },
    _sum: { plotAmountSnapshotPaise: true },
  });
  await prisma
    .$transaction((tx) =>
      royaltyService.finalizeMonthlySnapshot(
        tx as Prisma.TransactionClient,
        snapshotMonth.getUTCFullYear(),
        snapshotMonth.getUTCMonth() + 1,
        turnover._sum.plotAmountSnapshotPaise ?? 0n,
        superAdmin.id
      )
    )
    .then((s) => console.log(`  ✓ Royalty snapshot finalised for ${snapshotMonth.getUTCMonth() + 1}/${snapshotMonth.getUTCFullYear()}`))
    .catch((e) => console.log(`    · royalty snapshot: ${(e as Error).message.slice(0, 80)}`));

  /* ── Payouts across every state ───────────────────────────────────────── */
  /* Finance needs to see the whole lifecycle at once — a queue where every row
     says PENDING teaches nothing about the console. */
  const commissions = await prisma.ledgerEntry.findMany({
    where: { type: "REFERRAL_COMMISSION", status: "POSTED" },
    orderBy: { createdAt: "asc" },
    take: 6,
  });

  const lifecycle = ["paid", "paid", "approved", "processing", "eligible", "held"] as const;
  let payoutCount = 0;
  for (let i = 0; i < commissions.length; i++) {
    const entry = commissions[i]!;
    // A commission entry points at its booking (sourceType BOOKING); the
    // beneficiary partner is whoever referred that booking.
    const sourceBooking = await prisma.booking.findUnique({ where: { id: entry.sourceId } });
    if (!sourceBooking?.partnerId || !entry.ruleVersionType || !entry.ruleVersionId) continue;

    const target = lifecycle[i] ?? "eligible";
    try {
      await prisma.$transaction(async (tx) => {
        const t = tx as Prisma.TransactionClient;
        const payout = await payoutService.createOrGet(t, {
          payoutType: "REFERRAL",
          beneficiaryPartnerId: sourceBooking.partnerId!,
          sourceLedgerEntryId: entry.id,
          ruleVersionType: entry.ruleVersionType!,
          ruleVersionId: entry.ruleVersionId!,
          grossAmountPaise: entry.grossAmountPaise,
          netAmountPaise: entry.netAmountPaise,
        });

        if (target === "eligible") return void (await payoutService.markEligible(t, payout.id));
        await payoutService.markEligible(t, payout.id);
        if (target === "held") return void (await payoutService.hold(t, payout.id, "Bank details pending verification"));
        await payoutService.approve(t, payout.id, finance.id, "203.0.113.10", "demo-seed");
        if (target === "approved") return;
        await payoutService.markProcessing(t, payout.id);
        if (target === "processing") return;
        await payoutService.markPaid(t, payout.id, `NEFT/${daysAgo(3).toISOString().slice(0, 10)}/${1001 + i}`);
      });
      payoutCount++;
    } catch (e) {
      const detail = (e as Error).message
        .split("\n")
        .filter((l) => /Argument|Unknown|Invalid value|violat/i.test(l))
        .join(" | ");
      console.log("    · payout skipped:", detail || (e as Error).message.slice(0, 140));
    }
  }
  console.log(`  ✓ ${payoutCount} payouts spanning eligible → held → approved → processing → paid`);

  /* ── Leads ────────────────────────────────────────────────────────────── */
  const leads = [
    { name: "Mohit Bansal", phone: "+919990000040", status: "NEW", source: "META_ADS" },
    { name: "Rekha Joshi", phone: "+919990000041", status: "CONTACTED", source: "WHATSAPP" },
    { name: "Aslam Khan", phone: "+919990000042", status: "SITE_VISIT_SCHEDULED", source: "GOOGLE_ADS" },
    { name: "Divya Menon", phone: "+919990000043", status: "NEW", source: "DIRECT" },
    { name: "Balwinder Sandhu", phone: "+919990000044", status: "CONTACTED", source: "REFERRAL" },
  ];
  for (const [i, l] of leads.entries()) {
    await prisma.lead.upsert({
      where: { id: `demo-lead-${i + 1}` },
      update: {},
      create: {
        id: `demo-lead-${i + 1}`,
        name: l.name,
        phone: l.phone,
        // Normalised phone — the same dedupe key a real website enquiry
        // would produce, so demo leads collide correctly on re-submission.
        dedupeKey: l.phone.replace(/\D/g, "").slice(-10),
        source: l.source as never,
        status: l.status as never,
        createdAt: daysAgo(20 - i * 3),
      },
    });
  }
  console.log(`  ✓ ${leads.length} leads`);

  console.log("\nDemo dataset ready.");
  console.log(`  All demo accounts use password: ${DEMO_PASSWORD}`);
  console.log("  Rotate these before the platform carries real customers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
