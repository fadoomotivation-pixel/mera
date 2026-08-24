import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/SiteChrome";
import { PhotoSlot } from "@/components/marketing/PhotoSlot";
import { KhatuHeroArt } from "@/components/marketing/KhatuHeroArt";
import { LeadForm } from "./LeadForm";
import { ButtonLink, Card, Eyebrow, SectionTitle } from "@/components/ui/primitives";
import { Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { AMENITIES, PAYMENT_PLAN, PHOTOS, PLOT, PROJECT, rupees } from "@/lib/project";

export const metadata = {
  title: `MERA MAKAN — ${PROJECT.locality} में अपनी ज़मीन`,
  description: `${PROJECT.name}, ${PROJECT.localityEn} — a fully developed society with roads, electricity, water, park, market and guest house, on a transparent 90-day payment plan.`,
};

/* The 90-day plan as timeline steps. All three read as "upcoming" here because
   this is a marketing page describing the plan, not a customer's actual
   progress — the customer portal is where steps go green. */
const PLAN_STEPS: TimelineStep[] = PAYMENT_PLAN.map((p, i) => ({
  key: p.monthEn,
  marker: String(i + 1),
  title: p.month,
  state: "upcoming",
  value: (
    <span className="tnum font-display text-money-md text-navy-900">{rupees(p.amount)}</span>
  ),
  meta: `${p.monthEn} · ${p.percent}`,
}));

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* ─────────────────────────── Hero ─────────────────────────── */}
        <section className="relative isolate min-h-[92svh] overflow-hidden pb-20 pt-32 sm:pb-28">
          {PHOTOS.hero ? (
            <div className="absolute inset-0 -z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTOS.hero} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/55 to-navy-900/75" />
            </div>
          ) : (
            <KhatuHeroArt className="-z-10" />
          )}

          <div className="shell flex min-h-[62svh] flex-col justify-center">
            <div className="max-w-3xl animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-pill border border-gold-500/30 bg-navy-900/40 px-3.5 py-1.5 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                <span className="font-deva text-[13px] font-medium text-gold-300">
                  {PROJECT.locality} · {PROJECT.district}
                </span>
              </span>

              {/* The promise, in the language it is felt in. */}
              <h1 className="mt-7 font-deva text-[clamp(2.4rem,7.4vw,4.75rem)] font-bold leading-[1.14] tracking-tight text-ivory-50">
                श्याम जी की नगरी में,
                <br />
                <span className="text-gold-400">अपनी ज़मीन।</span>
              </h1>

              <p className="mt-7 max-w-xl font-deva text-[17px] leading-relaxed text-navy-100 sm:text-lg">
                {PROJECT.templeProximity} — सड़क, बिजली, पानी, पार्क, मार्केट और गेस्ट हाउस के साथ
                पूरी तरह विकसित सोसाइटी।
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-navy-200">
                {PLOT.sizeLabel} ({PLOT.gaj} गज) plots on a transparent 90-day payment plan.
              </p>

              {/* Two actions. Not ten. */}
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <ButtonLink href="#enquire" variant="gold" size="lg">
                  साइट विज़िट बुक करें
                </ButtonLink>
                <ButtonLink href="#property" variant="onNavy" size="lg">
                  प्लॉट व कीमत देखें
                </ButtonLink>
              </div>
            </div>
          </div>

          {/* Price rail — the single number a visitor came for, resolved at the
              bottom of the fold rather than shouted in the headline. */}
          <div className="shell mt-14">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6 rounded-card border border-ivory-50/10 bg-navy-900/50 px-6 py-6 backdrop-blur-sm sm:px-8">
              <Fact label="प्लॉट साइज़" value={`${PLOT.sizeLabel}`} sub={`${PLOT.gaj} गज`} />
              <Fact label="दर" value={`${rupees(PLOT.ratePerGaj)}`} sub="प्रति गज" />
              <Fact label="प्लॉट राशि" value={rupees(PLOT.plotAmount)} />
              <div className="ml-auto">
                <p className="text-eyebrow uppercase text-gold-400">कुल भुगतान</p>
                <p className="tnum mt-1.5 font-display text-money-xl font-bold text-ivory-50">
                  {rupees(PLOT.total)}
                </p>
                <p className="mt-1 text-caption text-navy-300">
                  {rupees(PLOT.plotAmount)} + {rupees(PLOT.registration)} रजिस्ट्रेशन
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── Why here ─────────────────────────── */}
        <section id="location" className="scroll-mt-24 bg-ivory-100 py-section">
          <div className="shell">
            <SectionTitle
              eyebrow="Location"
              title={
                <>
                  बाबा के धाम के पास,
                  <br className="hidden sm:block" /> एक बसी-बसाई सोसाइटी।
                </>
              }
              lead={`${PROJECT.name} is being developed at ${PROJECT.localityEn}, ${PROJECT.districtEn} — one of Rajasthan's most visited pilgrimage towns, with a steady year-round flow of devotees and a growing need for family accommodation.`}
            />

            <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <PhotoSlot
                label="Khatu Shyam Ji temple"
                src={PHOTOS.temple}
                alt="Khatu Shyam Ji temple"
                ratio="4/3"
                caption="खाटू श्याम जी — सीकर, राजस्थान"
              />
              <div className="grid content-between gap-6">
                <Point
                  hi="दर्शन पास ही"
                  en="Darshan close by"
                  body={`${PROJECT.templeProximityEn}, so a visit is a short trip rather than a journey — for you, and for family who come to stay.`}
                />
                <Point
                  hi="विकसित ज़मीन"
                  en="Developed, not bare"
                  body="Roads, electricity, water, park, market and a guest house are part of the society — you are buying into a place that is already built, not a promise on paper."
                />
                <Point
                  hi="साफ़ कागज़"
                  en="Clean paperwork"
                  body="A fixed 90-day schedule, a stated registration fee, and a receipt for every payment. Nothing is settled in conversation."
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── The property ─────────────────────────── */}
        <section id="property" className="scroll-mt-24 bg-navy-900 py-section text-ivory-50">
          <div className="shell">
            <SectionTitle
              tone="onNavy"
              eyebrow="The property"
              title="पूरी तरह विकसित सोसाइटी"
              lead="Six things every family asks about — all of them part of the society, not extras."
            />

            <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {AMENITIES.map((a, i) => (
                <div key={a.en}>
                  <PhotoSlot
                    label={a.en}
                    src={i === 0 ? PHOTOS.roads : i === 3 ? PHOTOS.park : ""}
                    ratio="4/3"
                  />
                  <p className="mt-4 font-deva text-lg font-semibold text-ivory-50">{a.hi}</p>
                  <p className="mt-0.5 text-eyebrow uppercase text-gold-400">{a.en}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-navy-200">{a.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-2">
              <PhotoSlot label="Society entrance" src={PHOTOS.siteEntry} ratio="3/2" />
              <PhotoSlot label="Plot layout plan" src={PHOTOS.plotLayout} ratio="3/2" />
            </div>
          </div>
        </section>

        {/* ─────────────────────────── Payment plan ─────────────────────────── */}
        <section id="plan" className="scroll-mt-24 bg-ivory-100 py-section">
          <div className="shell">
            <SectionTitle
              eyebrow="90-day payment plan"
              title="तीन किस्तें। कोई छुपा हुआ खर्च नहीं।"
              lead="The full schedule, stated up front. Every instalment is receipted, and you can see exactly what is paid and what remains in your customer portal."
            />

            <Card className="mt-12 p-7 sm:p-10">
              <Timeline steps={PLAN_STEPS} orientation="responsive" />

              <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-navy-900/[0.08] pt-7">
                <div>
                  <p className="text-eyebrow uppercase text-navy-400">प्लॉट राशि</p>
                  <p className="tnum mt-1 font-display text-money-lg text-navy-900">
                    {rupees(PLOT.plotAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-eyebrow uppercase text-navy-400">रजिस्ट्रेशन (एक बार)</p>
                  <p className="tnum mt-1 font-display text-money-lg text-navy-900">
                    {rupees(PLOT.registration)}
                  </p>
                </div>
                <div className="rounded-card bg-gold-100 px-5 py-3.5">
                  <p className="text-eyebrow uppercase text-gold-700">कुल</p>
                  <p className="tnum mt-1 font-display text-money-lg font-bold text-navy-900">
                    {rupees(PLOT.total)}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-caption leading-relaxed text-navy-500">
                Agreement and documentation papers are paid by the customer at the first instance.
              </p>
            </Card>
          </div>
        </section>

        {/* ─────────────────────────── Cash Plot benefit ─────────────────────────── */}
        <section className="bg-navy-800 py-section text-ivory-50">
          <div className="shell grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow tone="onNavy">Cash Plot benefit</Eyebrow>
              <p className="mt-5 font-display text-[clamp(3.5rem,11vw,6rem)] font-bold leading-none text-gold-400">
                1%
                <span className="ml-3 align-middle text-[0.3em] font-semibold uppercase tracking-[0.18em] text-ivory-50/70">
                  प्रति माह
                </span>
              </p>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-navy-100">
                पात्र Cash Plot बुकिंग पर, अधिकतम 12 महीने तक — लागू business rules के अनुसार।
              </p>
            </div>

            <Card tone="navy" className="border-ivory-50/12 bg-navy-900/60 p-7 sm:p-9">
              <p className="text-[15px] leading-relaxed text-navy-100">
                This is a company-defined benefit under MERA MAKAN&apos;s published business rules —
                not a guaranteed investment return. Eligibility, the calculation basis and the
                duration are confirmed on your booking statement, and every credit appears in your
                customer portal with its own date and status.
              </p>
              <dl className="mt-7 grid grid-cols-2 gap-5 border-t border-ivory-50/10 pt-7">
                <div>
                  <dt className="text-eyebrow uppercase text-gold-400">Applies to</dt>
                  <dd className="mt-1.5 text-sm text-ivory-50">Eligible Cash Plot bookings</dd>
                </div>
                <div>
                  <dt className="text-eyebrow uppercase text-gold-400">Maximum duration</dt>
                  <dd className="mt-1.5 text-sm text-ivory-50">12 months</dd>
                </div>
              </dl>
            </Card>
          </div>
        </section>

        {/* ─────────────────────────── Enquiry ─────────────────────────── */}
        <section id="enquire" className="scroll-mt-24 bg-ivory-100 py-section">
          <div className="shell grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <SectionTitle
                eyebrow="Book a site visit"
                title="ज़मीन देखिए, फिर तय कीजिए।"
                lead="Leave your number and our team will call to arrange a visit at a time that suits you. No payment is required to see the site."
              />
              <div className="mt-10 space-y-5">
                <Point hi="कोई दबाव नहीं" en="No pressure" body="A site visit is a visit. Nothing is booked until you decide it should be." />
                <Point hi="सीधी बात" en="Straight answers" body="Price, plan, paperwork and possession — asked and answered on the spot." />
              </div>
            </div>

            <Card className="p-7 sm:p-8">
              <LeadForm />
            </Card>
          </div>
        </section>

        {/* ─────────────────────────── Channel partner ─────────────────────────── */}
        <section className="border-t border-navy-900/[0.08] bg-ivory-50 py-20">
          <div className="shell flex flex-wrap items-center justify-between gap-8">
            <div className="max-w-xl">
              <Eyebrow>Channel Partner</Eyebrow>
              <h2 className="mt-3 font-deva text-2xl font-bold text-navy-900 sm:text-3xl">
                Property बेचिए. अपना business बनाइए.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-navy-500">
                Five separate income streams, each with its own terms and payout cycle.
              </p>
            </div>
            <ButtonLink href="/partner-programme" size="lg">
              Programme देखें
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/* ─────────────────────────── small pieces ─────────────────────────── */

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-deva text-eyebrow uppercase tracking-[0.12em] text-navy-300">{label}</p>
      <p className="tnum mt-1.5 font-display text-money-md text-ivory-50">{value}</p>
      {sub && <p className="mt-0.5 text-caption text-navy-300">{sub}</p>}
    </div>
  );
}

function Point({ hi, en, body }: { hi: string; en: string; body: string }) {
  return (
    <div className="border-l-2 border-gold-500/40 pl-5">
      <p className="font-deva text-lg font-semibold text-navy-900">{hi}</p>
      <p className="mt-0.5 text-eyebrow uppercase text-gold-600">{en}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-navy-500">{body}</p>
    </div>
  );
}
