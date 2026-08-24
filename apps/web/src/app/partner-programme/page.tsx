import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { PhotoSlot } from "@/components/marketing/PhotoSlot";
import { AchievementLadder, type LadderRung } from "@/components/ui/Timeline";
import { ButtonLink, Card, Eyebrow, SectionTitle } from "@/components/ui/primitives";
import { Money } from "@/components/ui/Money";
import { CLOSING_CYCLES, STREAMS, TIERS, requirement, royaltyDuration } from "@/lib/programme";

export const metadata: Metadata = {
  title: "Become a Channel Partner — MERA MAKAN",
  description:
    "Sell real property and build a real business. Five separate income streams, transparent closing cycles and published business rules.",
};

/** Public channel-partner page — closes the gap recorded in
 * docs/07-product-alignment-audit.md §G1, where the deck's entire closing
 * call to action had no home online.
 *
 * Tone discipline: this reads as a professional sales career, not a scheme.
 * No combined percentages, no income projections, no "earn ₹X per month"
 * claims, no network diagrams, and none of the forbidden vocabulary. */
export default function PartnerProgrammePage() {
  const ladder: LadderRung[] = TIERS.map((t) => ({
    key: t.code,
    rank: t.code,
    tier: t.name,
    requirement: requirement(t),
    // Locked throughout: this is a public page, nobody is signed in, so no
    // rung may imply achievement.
    state: "locked",
    value: (
      <div>
        <p className="font-display text-sm font-semibold text-navy-900">{royaltyDuration(t.months)}</p>
        <p className="text-caption text-navy-400">royalty</p>
      </div>
    ),
  }));

  return (
    <main>
      <SiteHeader />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy-900 pb-section pt-32 sm:pt-40">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-navy-800 via-navy-900 to-navy-900" />
          <div
            className="absolute -left-24 top-10 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #C9A227 0%, transparent 68%)" }}
          />
        </div>

        <div className="shell relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow tone="onNavy">Channel partner programme</Eyebrow>
            <h1 className="mt-6 font-deva text-display-md leading-[1.26] text-ivory-50">
              Property बेचिए.
              <br />
              <span className="text-gold-400">अपना business बनाइए.</span>
            </h1>
            <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-navy-200">
              Sell real property in a fully developed society, with published business rules, fixed closing cycles and
              transparent deductions on every payout.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="#apply" variant="gold" size="lg">
                Become a channel partner
              </ButtonLink>
              <ButtonLink href="/partner/login" variant="onNavy" size="lg">
                Partner sign in
              </ButtonLink>
            </div>
          </div>

          <PhotoSlot label="Channel partner with customers at site" ratio="4/3" priority />
        </div>
      </section>

      {/* ───────────────────────── The product you sell ───────────────────────── */}
      <section className="py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="What you sell"
            title="A real plot, in a society that already exists."
            lead="Roads, electricity, water, park, market and guest house — built before the first plot is sold."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <Card tone="quiet" className="p-7">
              <Eyebrow>Plot</Eyebrow>
              <p className="mt-3 font-display text-2xl font-semibold text-navy-900">50 Gaj</p>
              <p className="tnum mt-1 text-sm text-navy-500">15 × 30 ft</p>
            </Card>
            <Card tone="quiet" className="p-7">
              <Eyebrow>Customer outlay</Eyebrow>
              <p className="tnum mt-3 font-display text-2xl font-semibold text-navy-900">₹3,51,000</p>
              <p className="mt-1 text-sm text-navy-500">Plot ₹3,50,000 + ₹1,000 registration</p>
            </Card>
            <Card tone="quiet" className="p-7">
              <Eyebrow>Payment</Eyebrow>
              <p className="mt-3 font-display text-2xl font-semibold text-navy-900">90 days</p>
              <p className="mt-1 text-sm text-navy-500">30% · 30% · 40%</p>
            </Card>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Five streams ─────────────────────────
          Presented as five distinct cards. They are never added together —
          there is no combined figure anywhere on this page. */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="Income"
            title="Five separate income streams."
            lead="Each is governed by its own published business rule, calculated separately and paid separately."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STREAMS.map((s) => (
              <Card key={s.no} className="flex flex-col p-7">
                <span className="tnum font-display text-sm font-bold text-gold-600">{s.no}</span>
                <h3 className="mt-4 text-eyebrow uppercase text-navy-400">{s.name}</h3>
                <p className="mt-2 font-display text-display-md leading-none text-navy-900">{s.headline}</p>
                {s.qualifier && <p className="mt-2 text-sm font-medium text-navy-500">{s.qualifier}</p>}
                <p className="mt-5 flex-1 text-caption leading-relaxed text-navy-500">{s.blurb}</p>
              </Card>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-caption leading-relaxed text-navy-400">
            These are five distinct programmes with separate rules and separate qualification. They are not combined
            into a single rate, and none of them is presented as a guaranteed return.
          </p>
        </div>
      </section>

      {/* ───────────────────────── Closing cycles ───────────────────────── */}
      <section className="py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="Referral payout"
            title="Fixed closing cycles. Known payout dates."
            lead="Every referral commission belongs to exactly one closing cycle, and each cycle pays five days after it closes."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {CLOSING_CYCLES.map((c) => (
              <Card key={c.window} className="p-7">
                <Eyebrow>Closing</Eyebrow>
                <p className="tnum mt-3 font-display text-2xl font-semibold text-navy-900">{c.window}</p>
                <p className="mt-1 text-caption text-navy-400">{c.days}</p>
                <div className="mt-6 border-t hairline pt-5">
                  <Eyebrow>Payout release</Eyebrow>
                  <p className="tnum mt-2 font-display text-money-md text-gold-600">{c.payout}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Worked example. Uses the deck's own numbers and shows the full
              gross → net derivation, because a partner should never have to
              discover deductions on their first payout. */}
          <Card tone="navy" className="mt-8 p-8 sm:p-10">
            <Eyebrow tone="onNavy">Worked example</Eyebrow>
            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div>
                <p className="text-sm text-navy-300">Plot amount</p>
                <p className="tnum mt-1.5 font-display text-money-lg text-ivory-50">₹3,50,000</p>
                <p className="mt-1 text-caption text-navy-400">Registration is not part of the commission base.</p>
              </div>

              <div className="hidden text-center lg:block">
                <span className="text-2xl text-gold-400">×10%</span>
              </div>

              <div className="space-y-2.5 rounded-card bg-navy-800 p-6">
                <Row label="Gross commission" value="₹35,000" />
                <Row label="Admin charge (5%)" value="−₹1,750" tone="minus" />
                <Row label="TDS (2%, as applicable)" value="−₹700" tone="minus" />
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ivory-50/15 pt-4">
                  <span className="text-eyebrow uppercase text-gold-400">Net</span>
                  <span className="tnum font-display text-money-lg text-gold-400">₹32,550</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ───────────────────────── Balance Sheet ───────────────────────── */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="Balance Sheet · 8%"
            title="Generation to generation."
            lead="Business generated through the generation-to-generation structure creates an eligible balance that can carry forward according to the company plan."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-4">
            {["Input", "Output", "Balance", "Carry forward"].map((stage, i) => (
              <Card key={stage} tone={i === 3 ? "navy" : "quiet"} className="relative p-7 text-center">
                <p
                  className={`text-eyebrow uppercase ${i === 3 ? "text-gold-400" : "text-navy-400"}`}
                >
                  Step {i + 1}
                </p>
                <p className={`mt-3 font-display text-lg font-semibold ${i === 3 ? "text-ivory-50" : "text-navy-900"}`}>
                  {stage}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Royalty ───────────────────────── */}
      <section className="py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="Royalty · 2% of monthly turnover"
            title="Achieve the tier. Receive the stated duration."
            lead="2% of total monthly turnover is allocated to the Royalty Pool and shared equally among eligible achievers at the attained leadership tier."
          />

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_380px]">
            <AchievementLadder rungs={ladder} />

            <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
              <Card tone="navy" className="p-7">
                <Eyebrow tone="onNavy">How the pool works</Eyebrow>
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-sm text-navy-300">Monthly turnover</p>
                    <p className="tnum mt-1 font-display text-money-md text-ivory-50">₹1,00,00,000</p>
                  </div>
                  <div className="border-t border-ivory-50/10 pt-5">
                    <p className="text-sm text-navy-300">2% Royalty Pool</p>
                    <p className="tnum mt-1 font-display text-money-lg text-gold-400">₹2,00,000</p>
                  </div>
                </div>
                <div className="mt-6 space-y-2.5 border-t border-ivory-50/10 pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-navy-300">1 eligible achiever</span>
                    <span className="tnum font-semibold text-ivory-50">₹2,00,000</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-navy-300">4 eligible achievers</span>
                    <span className="tnum font-semibold text-ivory-50">₹50,000 each</span>
                  </div>
                </div>
              </Card>
              <p className="text-caption leading-relaxed text-navy-400">
                Royalty is a separate programme from Rewards. Illustrative figures only — actual pool size depends on
                actual monthly turnover.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Rewards ───────────────────────── */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="Rewards · 3% pool"
            title="A milestone journey, from your first mobile to ₹1 crore."
            lead="The applicable milestone reward becomes payable after the applicable property payment has been fully collected, according to approved company terms."
          />

          <ol className="mt-12 space-y-3">
            {TIERS.map((t, i) => {
              const finale = i === TIERS.length - 1;
              return (
                <li
                  key={t.code}
                  className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border p-5 sm:p-6 ${
                    finale ? "border-gold-500/40 bg-navy-900" : "border-navy-900/[0.07] bg-white"
                  }`}
                >
                  <span
                    className={`tnum w-8 font-display text-sm font-bold ${finale ? "text-gold-400" : "text-navy-300"}`}
                  >
                    {t.code}
                  </span>
                  <div className="min-w-[7rem]">
                    <p className={`tnum font-semibold ${finale ? "text-ivory-50" : "text-navy-900"}`}>
                      {requirement(t)}
                    </p>
                    <p className={`text-caption ${finale ? "text-navy-300" : "text-navy-400"}`}>{t.name}</p>
                  </div>
                  <p
                    className={`flex-1 font-display text-lg font-semibold ${
                      finale ? "text-gold-400" : "text-navy-900"
                    }`}
                  >
                    {t.reward}
                  </p>
                  <Money paise={t.rewardValuePaise} size="md" tone={finale ? "gold" : "default"} />
                </li>
              );
            })}
          </ol>

          <p className="mt-8 text-caption leading-relaxed text-navy-400">
            Rewards and Royalty are separate financial programmes. Achieving a tier with full cash collection makes both
            applicable — for example, 2 + 2 achieved with full cash collection corresponds to 1 Month Royalty and the
            ₹20,000 Mobile reward.
          </p>
        </div>
      </section>

      {/* ───────────────────────── Apply ───────────────────────── */}
      <section id="apply" className="scroll-mt-24 bg-navy-900 py-section">
        <div className="shell text-center">
          <h2 className="mx-auto max-w-2xl font-display text-display-md text-ivory-50">
            Start with one plot. Build from there.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-navy-200">
            Channel partner accounts are created by the MERA MAKAN team. Speak to us and we will set up your login and
            walk you through the business rules.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="tel:+910000000000" variant="gold" size="lg">
              Talk to our team
            </ButtonLink>
            <ButtonLink href="/" variant="onNavy" size="lg">
              See the property
            </ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "minus" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-navy-300">{label}</span>
      <span className={`tnum font-medium ${tone === "minus" ? "text-danger" : "text-ivory-50"}`}>{value}</span>
    </div>
  );
}
