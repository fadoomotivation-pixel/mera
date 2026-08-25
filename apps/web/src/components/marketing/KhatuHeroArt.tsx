/** Hero backdrop — a Khatu-Shyam-inspired dawn.
 *
 * This exists because the page had to carry real emotional weight before a
 * single licensed photograph was available. It is drawn, not photographed: a
 * temple silhouette (shikhara, dome, flag) against a sunrise, with the plot
 * grid of the township resolving out of the haze below it.
 *
 * It is a *silhouette*, not a depiction — no attempt is made to render the
 * actual shrine, which would be both inaccurate and inappropriate. When real
 * photography arrives, set PHOTOS.hero and this drops behind it as the
 * loading/fallback ground.
 *
 * Everything is inline SVG + CSS: no external requests, no layout shift, and
 * it stays crisp at any width. */
export function KhatuHeroArt({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {/* Night-to-dawn ground */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900" />

      {/* Sunrise glow behind the shikhara — the warm centre of the composition */}
      <div
        className="absolute left-1/2 top-[46%] h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(circle, rgba(201,162,39,0.55) 0%, rgba(201,162,39,0.18) 32%, transparent 66%)",
        }}
      />

      {/* Skyline */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        viewBox="0 0 1200 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="mm-silhouette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1D33" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0B1D33" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="mm-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0B1D33" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Distant haze band */}
        <rect x="0" y="150" width="1200" height="140" fill="url(#mm-haze)" />

        {/* Temple group, centred */}
        <g fill="url(#mm-silhouette)">
          {/* flag mast + pennant */}
          <rect x="597" y="52" width="3" height="34" />
          <path d="M600 56 L642 66 L600 76 Z" fill="#C9A227" fillOpacity="0.85" />

          {/* kalash + shikhara (curved spire) */}
          <circle cx="598.5" cy="92" r="6" />
          <path d="M598.5 100 C 574 132, 566 176, 562 214 L 635 214 C 631 176, 623 132, 598.5 100 Z" />

          {/* main hall with dome */}
          <path d="M548 214 h101 v18 h-101 Z" />
          <path d="M540 232 C 540 214, 657 214, 657 232 L 657 250 L 540 250 Z" />

          {/* flanking domes */}
          <path d="M470 250 C 470 224, 520 224, 520 250 Z" />
          <path d="M677 250 C 677 224, 727 224, 727 250 Z" />
          <circle cx="495" cy="220" r="4" />
          <circle cx="702" cy="220" r="4" />

          {/* plinth / base platform */}
          <rect x="452" y="250" width="293" height="26" />
          <rect x="436" y="276" width="325" height="14" />

          {/* low outbuildings, left and right, to widen the base */}
          <path d="M300 290 h130 v-34 h-130 Z" />
          <path d="M770 290 h140 v-28 h-140 Z" />
          <rect x="236" y="290" width="64" height="0" />
        </g>

        {/* Township plot grid emerging from the haze — the land itself */}
        <g stroke="#F5F2EC" strokeOpacity="0.10" strokeWidth="1">
          {Array.from({ length: 25 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 50} y1={300} x2={i * 50 - 120} y2={420} />
          ))}
          {[300, 330, 362, 396].map((y, i) => (
            <line key={`h${i}`} x1={-120} y1={y} x2={1320} y2={y} />
          ))}
        </g>

        {/* A few plots picked out in gold — "yours could be one of these" */}
        <g fill="#C9A227" fillOpacity="0.14">
          <path d="M474 300 l50 0 l-12 30 l-50 0 Z" />
          <path d="M628 330 l50 0 l-13 32 l-50 0 Z" />
          <path d="M330 362 l52 0 l-14 34 l-52 0 Z" />
        </g>
      </svg>

      {/* Vignette so headline type always has contrast to sit on */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/35 to-navy-900/70" />
    </div>
  );
}
