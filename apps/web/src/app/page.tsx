import { LeadForm } from "./LeadForm";

const AMENITIES = [
  { label: "Roads", icon: "🛣️" },
  { label: "Electricity", icon: "💡" },
  { label: "Water", icon: "💧" },
  { label: "Park", icon: "🌳" },
  { label: "Market", icon: "🏪" },
  { label: "Guest House", icon: "🏡" },
];

const PAYMENT_PLAN = [
  { month: "Month 1", percent: "30%", amount: "₹1,05,000" },
  { month: "Month 2", percent: "30%", amount: "₹1,05,000" },
  { month: "Month 3", percent: "40%", amount: "₹1,40,000" },
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
    q: "What is Cash Plot ROI?",
    a: "On eligible Cash Plot bookings, MERA MAKAN credits 1% per month for up to 12 months, per the applicable business rules. This is a company-defined benefit, not a guaranteed investment return, and the exact calculation basis is confirmed on your booking statement.",
  },
  {
    q: "Is this a network-marketing scheme?",
    a: "No. MERA MAKAN is a real-estate sales and channel-partner business. Plot pricing, payment plans, and registration are the same for every customer regardless of how they found us.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold tracking-tight text-brand-700">MERA MAKAN</span>
            <span className="hidden text-xs text-ink-700 sm:inline">अपनी ज़मीन, अपनी पहचान</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium text-ink-700">
            <a href="/customer/login" className="hover:text-brand-700">
              Customer Login
            </a>
            <a href="/partner/login" className="hover:text-brand-700">
              Partner Login
            </a>
            <a
              href="#lead-form"
              className="rounded-full bg-brand-700 px-4 py-2 text-white shadow-sm hover:bg-brand-800"
            >
              Book a Site Visit
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-16 text-white sm:py-24"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">MERA MAKAN</p>
          <p className="mt-1 text-lg text-brand-50">अपनी ज़मीन, अपनी पहचान</p>
          <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            Fully Developed Society. Clear Ownership. Simple Payment Plan.
          </h1>
          <p className="mt-4 max-w-xl text-brand-50">
            अपनी रजिस्ट्री कराइए • Cash का Benefit पाएँ — plots ready with roads, electricity, water,
            park, market and guest house, on a transparent 90-day payment plan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#lead-form" className="rounded-full bg-white px-6 py-3 font-semibold text-brand-800 shadow-lg hover:bg-brand-50">
              Book a Site Visit
            </a>
            <a href="#availability" className="rounded-full border border-white/60 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Check Plot Availability
            </a>
          </div>
          <div className="mt-6 flex gap-3 text-sm">
            <a href="https://wa.me/910000000000" className="rounded-full bg-white/15 px-4 py-2 font-medium hover:bg-white/25">
              💬 WhatsApp Us
            </a>
            <a href="tel:+910000000000" className="rounded-full bg-white/15 px-4 py-2 font-medium hover:bg-white/25">
              📞 Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section id="availability" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-ink-900">A Fully Developed Society</h2>
        <p className="mt-2 text-ink-700">ठहरने और सुकून भरे पल हमारे साथ बिताइए।</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {AMENITIES.map((a) => (
            <div key={a.label} className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center shadow-sm">
              <div className="text-3xl">{a.icon}</div>
              <div className="mt-2 text-sm font-semibold text-ink-900">{a.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Property offer */}
      <section className="bg-ink-900 px-4 py-14 text-white">
        <div className="mx-auto max-w-6xl grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Cash Plot — Plot Details</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-white/60">Plot Size</dt>
                <dd className="font-semibold">15 × 30 = 50 Gaj</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-white/60">Rate</dt>
                <dd className="font-semibold">₹7,000 / Gaj</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-white/60">Plot Amount</dt>
                <dd className="font-semibold">₹3,50,000</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-white/60">Registration (one-time)</dt>
                <dd className="font-semibold">₹1,000</dd>
              </div>
              <div className="flex justify-between pt-1 text-base">
                <dt className="font-bold text-brand-200">Total Customer Outlay</dt>
                <dd className="font-bold text-brand-200">₹3,51,000</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-bold">90-Day Payment Plan</h2>
            <div className="mt-6 space-y-3">
              {PAYMENT_PLAN.map((p) => (
                <div key={p.month} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="font-medium">{p.month}</span>
                  <span className="text-white/60">{p.percent}</span>
                  <span className="font-semibold text-brand-200">{p.amount}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-brand-400/30 bg-brand-900/40 p-4 text-sm">
              <p className="font-semibold text-brand-200">Cash Plot ROI</p>
              <p className="mt-1 text-white/70">
                1% per month, up to 12 months, on eligible Cash Plot bookings — a company-defined benefit
                under MERA MAKAN&apos;s published business rules, not a guaranteed investment return.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="lead-form" className="mx-auto max-w-2xl px-4 py-16">
        <h2 className="text-2xl font-bold text-ink-900">Book a Site Visit</h2>
        <p className="mt-2 text-ink-700">Share your details and our team will confirm your visit slot.</p>
        <LeadForm />
      </section>

      {/* FAQ */}
      <section className="bg-brand-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-ink-900">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-4">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-xl border border-brand-100 bg-white p-4">
                <summary className="cursor-pointer font-semibold text-ink-900">{f.q}</summary>
                <p className="mt-2 text-sm text-ink-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-100 px-4 py-10 text-sm text-ink-700">
        <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-3">
          <div>
            <p className="font-bold text-brand-700">MERA MAKAN</p>
            <p className="mt-1">अपनी ज़मीन, अपनी पहचान</p>
          </div>
          <div>
            <p className="font-semibold text-ink-900">Office</p>
            <p className="mt-1">MERA MAKAN Sales Office, [Address on file]</p>
            <p>+91 00000 00000</p>
          </div>
          <div>
            <p className="font-semibold text-ink-900">Legal</p>
            <p className="mt-1">
              <a href="#" className="hover:text-brand-700">Terms &amp; Conditions</a>
            </p>
            <p>
              <a href="#" className="hover:text-brand-700">Privacy Policy</a>
            </p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-ink-700/70">
          Cash Plot ROI, Referral, Balance Sheet, Royalty and Reward programs are internal
          business/channel-partner arrangements governed by MERA MAKAN&apos;s published business rules
          and are not represented here as guaranteed returns.
        </p>
      </footer>
    </main>
  );
}
