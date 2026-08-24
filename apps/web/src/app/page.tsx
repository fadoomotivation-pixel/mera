import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { PhotoSlot } from "@/components/marketing/PhotoSlot";
import { Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { ButtonLink, Card, Eyebrow, SectionTitle } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "MERA MAKAN — अपनी ज़मीन, अपनी पहचान",
  description:
    "A 50 Gaj plot in a fully developed society — roads, electricity, water, park, market and guest house — for ₹3,51,000 on a transparent 90-day payment plan.",
};

/* The 90-day plan. Every figure here is derived from the same numbers the
   backend holds (₹7,000/Gaj × 50 Gaj = ₹3,50,000) — never invented in copy. */
const PLAN: TimelineStep[] = [
  {
    key: "m1",
    marker: "1",
    title: "Month 1",
    value: <span className="tnum font-display text-money-md text-navy-900">₹1,05,000</span>,
    meta: "30% of plot amount",
    state: "upcoming",
  },
  {
    key: "m2",
    marker: "2",
    title: "Month 2",
    value: <span className="tnum font-display text-money-md text-navy-900">₹1,05,000</span>,
    meta: "30% of plot amount",
    state: "upcoming",
  },
  {
    key: "m3",
    marker: "3",
    title: "Month 3",
    value: <span className="tnum font-display text-money-md text-navy-900">₹1,40,000</span>,
    meta: "40% of plot amount",
    state: "upcoming",
  },
];

const AMENITIES = [
  { label: "Roads", caption: "Laid, kerbed internal road network", shot: "Internal society road" },
  { label: "Electricity", caption: "Distribution and street lighting", shot: "Street lighting at dusk" },
  { label: "Water", caption: "Supply lines to every plot", shot: "Water infrastructure" },
  { label: "Park", caption: "Landscaped open green space", shot: "Society park" },
  { label: "Market", caption: "Everyday retail within the society", shot: "Market area" },
  { label: "Guest House", caption: "For visiting families and guests", shot: "Guest house exterior" },
];

const FAQS = [
  {
    q: "What exactly am I buying?",
    a: "A 15×30 (50 Gaj) plot at ₹7,000/Gaj = ₹3,50,000, plus a one-time ₹1,000 registration fee. Total outlay: ₹3,51,000.",
  },
  {
    q: "How does the 90-day payment plan work?",
    a: "30% in Month 1, 30% in Month 2, and 40% in Month 3 — a fixed, transparent schedule with no hidden charges.",
  },
  {
    q: "What is the Cash Plot benefit?",
    a: "On eligible Cash Plot bookings, MERA MAKAN credits 1% per month for up to 12 months, per the applicable business rules. This is a company-defined benefit, not a guaranteed investment return, and the exact calculation basis is confirmed on your booking statement.",
  },
  {
    q: "Who pays for the agreement and documentation papers?",
    a: "Agreement and documentation papers are paid by the customer at the first time, separately from the plot amount and registration fee.",
  },
  {
    q: "Is this a network-marketing scheme?",
    a: "No. MERA MAKAN is a real-estate sales and channel-partner business. Plot pricing, payment plans, and registration are the same for every customer regardless of how they found us.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <SiteHeader />

      {/* ───────────────────────── Hero ─────────────────────────
          One idea, two actions. The Devanagari headline is the hero — it is
          set larger than anything else on the page because it is the promise
          the whole business rests on. */}
      <section className="relative isolate overflow-hidden bg-navy-900 pb-20 pt-32 sm:pb-28 sm:pt-40">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-navy-800 via-navy-900 to-navy-900" />
          <div
            className="absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, #C9A227 0%, transparent 68%)" }}
          />
        </div>

        <div className="shell relative">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <div>
              <Eyebrow tone="onNavy">Fully developed society</Eyebrow>

              {/* Devanagari sets wider than Latin at the same point size, so
                  this is capped a step below the display scale to hold the
                  intended two-line break on desktop. */}
              <h1 className="mt-6 font-deva text-display-lg leading-[1.24] text-ivory-50">
                एक साफ़ सौदा।
                <br />
                <span className="text-gold-400">एक अपनी ज़मीन।</span>
              </h1>

              <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-navy-200">
                Fully Developed Society with Roads, Electricity, Water, Park, Market &amp; Guest House.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="#visit" variant="gold" size="lg">
                  Book a site visit
                </ButtonLink>
                <ButtonLink href="#property" variant="onNavy" size="lg">
                  Check plot availability
                </ButtonLink>
              </div>

              {/* Price anchor, deliberately understated here — the full
                  composition lives in the offer section below. */}
              <p className="mt-10 text-sm text-navy-300">
                50 Gaj plot ·{" "}
                <span className="tnum font-display text-lg font-semibold text-ivory-50">₹3,51,000</span> total ·
                90-day plan
              </p>
            </div>

            <PhotoSlot
              label="Aerial view of the development"
              src=""
              ratio="4/3"
              priority
              className="lg:mt-0"
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── The offer ─────────────────────────
          Visual hierarchy is the whole point of this block: ₹3,51,000 is the
          number a buyer must leave with, so the rate and sub-amounts are
          deliberately quieter. */}
      <section id="property" className="scroll-mt-24 py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="The property"
            title="One plot. One clear price."
            lead="No hidden charges, no variable pricing. Every customer pays the same."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
            <Card tone="navy" className="p-8 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <Eyebrow tone="onNavy">Plot size</Eyebrow>
                  <p className="mt-3 font-display text-display-md text-ivory-50">50 Gaj</p>
                  <p className="tnum mt-1 text-sm text-navy-300">15 × 30 ft</p>
                </div>
                <div className="text-right">
                  <Eyebrow tone="onNavy">Rate</Eyebrow>
                  <p className="tnum mt-3 font-display text-money-md text-ivory-50">₹7,000</p>
                  <p className="mt-1 text-sm text-navy-300">per Gaj</p>
                </div>
              </div>

              <div className="mt-9 space-y-3 border-t border-ivory-50/10 pt-8">
                <Line label="Plot amount" value="₹3,50,000" />
                <Line label="Registration (one-time)" value="₹1,000" />
              </div>

              <div className="mt-8 rounded-card bg-gold-500 p-6">
                <p className="text-eyebrow uppercase text-navy-900/60">Total customer outlay</p>
                <p className="tnum mt-2 font-display text-money-xl text-navy-900">₹3,51,000</p>
              </div>

              <p className="mt-6 text-caption leading-relaxed text-navy-300">
                Agreement / documentation papers are paid by the customer at the first time.
              </p>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              <PhotoSlot label="Plot layout drawing" caption="Indicative plot layout" ratio="4/3" />
              <PhotoSlot label="Site photograph" caption="Site as developed" ratio="4/3" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Payment plan ───────────────────────── */}
      <section id="plan" className="scroll-mt-24 bg-white py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="90-day payment plan"
            title="Three payments. Ninety days. Nothing else."
            lead="A fixed schedule agreed at booking — the same for every customer."
          />

          <Card tone="quiet" className="mt-12 p-8 sm:p-12">
            <Timeline steps={PLAN} orientation="responsive" />
          </Card>

          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4 rounded-card bg-navy-900 px-7 py-6">
            <p className="text-eyebrow uppercase text-gold-400">Plot amount total</p>
            <p className="tnum font-display text-money-lg text-ivory-50">₹3,50,000</p>
          </div>
        </div>
      </section>

      {/* ───────────────────────── What is built ─────────────────────────
          Photography with small captions — deliberately not a grid of icons. */}
      <section className="py-section">
        <div className="shell">
          <SectionTitle
            eyebrow="What is already built"
            title="A developed society, not an empty field."
            lead="Every plot sits inside completed infrastructure."
          />

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {AMENITIES.map((a) => (
              <div key={a.label}>
                <PhotoSlot label={a.shot} ratio="3/2" />
                <h3 className="mt-4 font-display text-lg font-semibold text-navy-900">{a.label}</h3>
                <p className="mt-1 text-caption text-navy-500">{a.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Location ───────────────────────── */}
      <section id="location" className="scroll-mt-24 bg-white py-section">
        <div className="shell">
          <SectionTitle eyebrow="Location" title="Where your land is." />

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <PhotoSlot label="Location / connectivity map" ratio="16/9" caption="Indicative location map" />
            <Card className="p-8">
              <Eyebrow>Project location</Eyebrow>
              <p className="mt-3 font-display text-xl font-semibold text-navy-900">Sunrise Society</p>
              <p className="mt-1 text-sm text-navy-500">Near NH-44, Sonipat</p>

              <div className="mt-8 border-t hairline pt-6">
                <Eyebrow>Connectivity</Eyebrow>
                <ul className="mt-4 space-y-3 text-sm text-navy-600">
                  <li className="flex justify-between gap-4">
                    <span>National Highway 44</span>
                    <span className="text-navy-400">Adjacent</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Sonipat city centre</span>
                    <span className="text-navy-400">Nearby</span>
                  </li>
                </ul>
                <p className="mt-6 text-caption text-navy-400">
                  Distances and travel times are indicative and confirmed at site visit.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Cash Plot benefit ─────────────────────────
          Framed as a company-defined benefit, never as an investment return.
          The legal wording below was reviewed and is carried verbatim. */}
      <section id="benefit" className="scroll-mt-24 py-section">
        <div className="shell">
          <Card tone="navy" className="overflow-hidden p-8 sm:p-14">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <Eyebrow tone="onNavy">Cash Plot benefit</Eyebrow>
                <p className="mt-5 font-display text-display-lg text-gold-400">1% / month</p>
                <p className="mt-4 text-[15px] text-navy-200">
                  Up to 12 months · On eligible Cash Plot bookings
                </p>
                <p className="mt-8 max-w-md text-caption leading-relaxed text-navy-300">
                  A company-defined benefit under MERA MAKAN&apos;s published business rules — not a guaranteed
                  investment return. The exact calculation basis is confirmed on your booking statement.
                </p>
              </div>
              <PhotoSlot label="Completed plot handover" ratio="3/2" />
            </div>
          </Card>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionTitle eyebrow="Questions" title="Answered plainly." />
          <dl className="mt-12 max-w-3xl divide-y divide-navy-900/[0.08]">
            {FAQS.map((f) => (
              <div key={f.q} className="py-7 first:pt-0">
                <dt className="font-display text-lg font-semibold text-navy-900">{f.q}</dt>
                <dd className="mt-2.5 text-[15px] leading-relaxed text-navy-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────────────────────── Site visit CTA ───────────────────────── */}
      <section id="visit" className="scroll-mt-24 bg-navy-900 py-section">
        <div className="shell text-center">
          <h2 className="mx-auto max-w-2xl font-display text-display-md text-ivory-50">
            See the society before you decide.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-navy-200">
            Walk the roads, see the park and the market, and stand on the plot. Then decide.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="tel:+910000000000" variant="gold" size="lg">
              Book a site visit
            </ButtonLink>
            <ButtonLink href="/partner-programme" variant="onNavy" size="lg">
              Become a channel partner
            </ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-navy-300">{label}</span>
      <span className="tnum font-display text-lg font-semibold text-ivory-50">{value}</span>
    </div>
  );
}
