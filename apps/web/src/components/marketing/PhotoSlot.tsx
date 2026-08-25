import type { ReactNode } from "react";

/** PhotoSlot — a real, designed placeholder for photography that does not
 * exist yet.
 *
 * The brief calls for large real-estate photography with small captions. No
 * licensed imagery ships with this repository, so rather than wire up broken
 * <img> tags or lorem-picsum links that would fail in production, every photo
 * position renders as a composed navy panel: correct aspect ratio, correct
 * place in the layout, correct caption treatment.
 *
 * The result reads as intentional rather than unfinished, and swapping in the
 * real asset is a one-line change — pass `src` and the panel becomes an
 * <img>. Drop files into `apps/web/public/photos/` and reference them as
 * `/photos/<name>.jpg`. See docs/08-design-system.md for the shot list. */

export function PhotoSlot({
  label,
  caption,
  src,
  alt,
  ratio = "4/3",
  className = "",
  overlay,
  priority,
}: {
  /** Shown only while no `src` is set — names the shot a photographer needs. */
  label: string;
  caption?: string;
  src?: string;
  alt?: string;
  ratio?: "4/3" | "16/9" | "3/2" | "1/1" | "21/9";
  className?: string;
  overlay?: ReactNode;
  priority?: boolean;
}) {
  const ratios = {
    "4/3": "aspect-[4/3]",
    "16/9": "aspect-[16/9]",
    "3/2": "aspect-[3/2]",
    "1/1": "aspect-square",
    "21/9": "aspect-[21/9]",
  } as const;

  return (
    <figure className={className}>
      <div className={`relative overflow-hidden rounded-card bg-navy-800 ${ratios[ratio]}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? label}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover"
          />
        ) : (
          <PlaceholderArt label={label} />
        )}
        {overlay}
      </div>
      {caption && <figcaption className="mt-3 text-caption text-navy-500">{caption}</figcaption>}
    </figure>
  );
}

/** A quiet architectural suggestion — horizon line, soft light, faint grid.
 * Enough structure to read as "a photograph belongs here", restrained enough
 * that it never competes with the type beside it. */
function PlaceholderArt({ label }: { label: string }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-700 via-navy-800 to-navy-900" />
      {/* horizon */}
      <div className="absolute inset-x-0 top-[58%] h-px bg-gold-500/20" />
      {/* soft light source */}
      <div
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #C9A227 0%, transparent 70%)" }}
      />
      {/* faint plot grid, echoing a layout drawing */}
      <svg aria-hidden className="absolute inset-x-0 bottom-0 h-[42%] w-full opacity-[0.14]" viewBox="0 0 200 60" preserveAspectRatio="none">
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20 - 10} y2="60" stroke="#F5F2EC" strokeWidth="0.4" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 15} x2="200" y2={i * 15} stroke="#F5F2EC" strokeWidth="0.4" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-4">
        <span className="rounded-pill border border-ivory-50/20 bg-navy-900/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-ivory-50/70 backdrop-blur-sm">
          {label}
        </span>
      </div>
    </div>
  );
}
