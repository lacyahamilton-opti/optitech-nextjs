import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cva } from "class-variance-authority";

// ─── Style option types (map 1:1 to CMS content properties) ─────────────────

/**
 * Art direction of the hero. Each value is a distinct composition that reuses
 * the same content (eyebrow / headline / body / dual CTA / optional visual) but
 * arranges it differently. "color" remains the ground-palette modifier within
 * every direction.
 *   editorialSplit — the default: solid-color text panel beside a contained visual
 *   spotlight      — a wide content panel leads beside a deliberately small,
 *                    offset-framed image; no full-bleed color panel
 *   overlap        — layered editorial; the headline plate is anchored to the
 *                    image's bottom edge and pulled up by a % of its own height,
 *                    at any viewport width or copy length
 *   diagonal       — a sharp diagonal seam between a color panel and a contained image, accent-lit
 */
export type HeroDirection =
  | "editorialSplit" | "spotlight" | "overlap" | "diagonal";

export type HeroStyleOptions = {
  /** Art direction / composition of the hero (see HeroDirection). */
  direction?: HeroDirection;
  /** Which side the text panel appears on at desktop widths */
  layout?: "imageRight" | "imageLeft";
  /** Background color of the text panel */
  color?: "brand" | "canvas" | "surface";
  /**
   * Entrance animation for the section.
   * "parallax": the frame fades in while the visual pushes in (scale settle)
   * inside its clipped panel — a depth entrance, layout-safe, no scroll listener.
   */
  animation?: "none" | "fade" | "slide" | "parallax";
};

// ─── CVA variant configs ─────────────────────────────────────────────────────

const sectionCva = cva("flex flex-col", {
  variants: {
    layout: {
      imageRight: "lg:flex-row",
      imageLeft:  "lg:flex-row-reverse",
    },
  },
  defaultVariants: { layout: "imageRight" },
});

const textPanelCva = cva(
  "px-md py-lg lg:px-lg lg:py-xl flex flex-col",
  {
    variants: {
      color: {
        brand:   "bg-brand-fill",
        canvas:  "bg-canvas",
        surface: "bg-surface",
      },
      mode: {
        // A touch wider than half so longer display headlines wrap to fewer lines.
        split: "lg:w-[58%]",
        full:  "w-full",
      },
    },
    defaultVariants: { color: "brand", mode: "split" },
  }
);

const eyebrowCva = cva("text-label tracking-label uppercase font-semibold", {
  variants: {
    color: {
      brand:   "text-fg-on-brand/60",
      canvas:  "text-fg-muted",
      surface: "text-fg-muted",
    },
  },
  defaultVariants: { color: "brand" },
});

const headlineCva = cva(
  "text-hero font-extrabold leading-display tracking-display",
  {
    variants: {
      color: {
        brand:   "text-fg-on-brand",
        canvas:  "text-fg",
        surface: "text-fg",
      },
    },
    defaultVariants: { color: "brand" },
  }
);

// Spotlight-only type voice: thin-but-large headline, medium-bold body — the
// opposite weight pairing from Overlap/Diagonal's extrabold headline + regular
// body, so the direction reads differently even set in the same family/scale.
const spotlightHeadlineCva = cva("text-hero font-light leading-display tracking-display text-balance", {
  variants: {
    color: {
      brand:   "text-fg-on-brand",
      canvas:  "text-fg",
      surface: "text-fg",
    },
  },
  defaultVariants: { color: "brand" },
});

const spotlightBodyCva = cva("text-body font-semibold leading-body max-w-(--ot-measure-tight)", {
  variants: {
    color: {
      brand:   "text-fg-on-brand/80",
      canvas:  "text-fg-muted",
      surface: "text-fg-muted",
    },
  },
  defaultVariants: { color: "brand" },
});

const bodyCva = cva("text-body leading-body max-w-(--ot-measure-tight)", {
  variants: {
    color: {
      brand:   "text-fg-on-brand/80",
      canvas:  "text-fg-muted",
      surface: "text-fg-muted",
    },
  },
  defaultVariants: { color: "brand" },
});

const primaryCtaCva = cva(
  "inline-block rounded-ot-control hover:-translate-y-0.5 hover:shadow-hover-lift text-label font-semibold tracking-label uppercase px-12 py-4 transition duration-150 ease-quick focus-visible:outline-2 focus-visible:outline-offset-[3px]",
  {
    variants: {
      color: {
        // On a brand panel the resting button is already brand-hover (deeper than
        // the panel); hover inverts to a light chip rather than jumping to canvas.
        brand:
          "bg-brand-hover hover:bg-fg-on-brand text-fg-on-brand hover:text-brand focus-visible:outline-fg-on-brand",
        canvas:
          "bg-brand hover:bg-brand-hover text-fg-on-brand focus-visible:outline-brand",
        surface:
          "bg-brand hover:bg-brand-hover text-fg-on-brand focus-visible:outline-brand",
      },
    },
    defaultVariants: { color: "brand" },
  }
);

const secondaryCtaCva = cva(
  "inline-block rounded-ot-control border text-label font-semibold tracking-label uppercase px-12 py-4 transition duration-150 ease-quick focus-visible:outline-2 focus-visible:outline-offset-[3px]",
  {
    variants: {
      color: {
        brand:
          "border-fg-on-brand/40 hover:border-fg-on-brand/70 hover:bg-fg-on-brand/8 text-fg-on-brand focus-visible:outline-fg-on-brand",
        canvas:
          "border-fg/40 hover:border-fg/70 hover:bg-fg/8 text-fg focus-visible:outline-fg",
        surface:
          "border-fg/40 hover:border-fg/70 hover:bg-fg/8 text-fg focus-visible:outline-fg",
      },
    },
    defaultVariants: { color: "brand" },
  }
);

// Editorial Split is a flush two-panel layout — the visual panel sits directly
// against the square text panel with no gap, so it always stays sharp-cornered
// (rounded-none) even when the theme's Corner Style axis is Soft/Rounded;
// rounding just this one edge would misalign it against the text panel.
const visualPanelCva = cva(
  "relative overflow-hidden rounded-none aspect-video lg:aspect-auto lg:flex-1",
  {
    variants: {
      color: {
        brand:   "bg-canvas",
        canvas:  "bg-surface",
        surface: "bg-canvas",
      },
    },
    defaultVariants: { color: "brand" },
  }
);

// ─── Component ───────────────────────────────────────────────────────────────

export type HeroBlockProps = {
  eyebrow?: string;
  headline: string;
  body?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** CMS image URL — rendered with next/image fill inside the visual panel */
  visualSrc?: string;
  visualAlt?: string;
  /** Non-image override — SVG, code sample, illustration, etc. Takes precedence over visualSrc */
  visual?: ReactNode;
  styleOptions?: HeroStyleOptions;
  pa?: (prop?: string | { key: string }) => Record<string, string | undefined>;
};

export default function HeroBlock({
  eyebrow,
  headline,
  body,
  primaryCta,
  secondaryCta,
  visualSrc,
  visualAlt = "",
  visual,
  styleOptions = {},
  pa = () => ({}),
}: HeroBlockProps) {
  const { direction = "editorialSplit", layout = "imageRight", color = "brand", animation = "none" } = styleOptions;

  // Non-default art directions are self-contained compositions; delegate to them.
  // They reuse the same content + the color/animation modifiers.
  if (direction !== "editorialSplit") {
    const shared = { eyebrow, headline, body, primaryCta, secondaryCta, visualSrc, visualAlt, visual, color, layout, animation, pa };
    if (direction === "spotlight") return <SpotlightHero {...shared} />;
    if (direction === "overlap")   return <OverlapHero {...shared} />;
    if (direction === "diagonal")  return <DiagonalHero {...shared} />;
  }

  const hasVisual  = !!(visual || visualSrc);
  const isAnimated = animation !== "none";

  const animClass = animation === "fade"
    ? "motion-safe:animate-fade-in"
    : isAnimated ? "motion-safe:animate-slide-up" : "";

  // Parallax: the visual frame fades in while the image inside it pushes in
  // (scale 1.08 → 1). Clipped by the panel's overflow-hidden, so it reads as
  // depth with no layout impact and no scroll listener.
  const visualPanelAnim = animation === "parallax" ? "motion-safe:animate-fade-in" : animClass;
  const visualImgAnim   = animation === "parallax" ? "motion-safe:animate-hero-zoom" : "";

  const stagger = (delay: number): CSSProperties =>
    isAnimated ? { animationDelay: `${delay}ms` } : {};

  // Tells the atmospheric layer where the light source is relative to the panel.
  // imageRight → image is on the right → light spills in from the right edge.
  // imageLeft  → image is on the left  → light spills in from the left edge.
  // full       → no image              → overhead-center ambient source.
  const atmosLayout = hasVisual ? layout : "full"

  return (
    <section className={sectionCva({ layout })} aria-label="Hero">

      {/* ── Text panel ── */}
      {/* data-theme="dark" on brand panels ensures tokens like bg-canvas, text-fg,
          and button hover states always resolve to dark-mode values regardless of
          the site's page-level theme (light or dark). */}
      <div
        className={`${textPanelCva({ color, mode: hasVisual ? "split" : "full" })} relative overflow-hidden`}
        data-theme={color === 'brand' ? 'dark' : undefined}
      >
        {/* Atmospheric depth layer — edge-lit gradient + micro-grain texture.
            Absolutely positioned so it has zero impact on flex layout. */}
        <div
          className="hero-atmos"
          data-color={color}
          data-layout={atmosLayout}
          data-pause-offscreen
          aria-hidden="true"
        />

        {/* Content lifted above the atmospheric layer */}
        <div className="relative z-10 flex flex-col gap-lg">
          {eyebrow && (
            <p className={`${eyebrowCva({ color })} ${animClass}`} style={stagger(0)} {...pa('eyebrow')}>
              {eyebrow}
            </p>
          )}
          <h1 className={`${headlineCva({ color })} ${animClass}`} style={stagger(100)} {...pa('headline')}>
            {headline}
          </h1>
          {body && (
            <p className={`${bodyCva({ color })} ${animClass}`} style={stagger(200)} {...pa('body')}>
              {body}
            </p>
          )}
        </div>

        {(primaryCta || secondaryCta) && (
          <div className={`relative z-10 mt-xl flex flex-wrap gap-sm ${animClass}`} style={stagger(320)}>
            {primaryCta && (
              <Link href={primaryCta.href} className={primaryCtaCva({ color })} {...pa('primaryCtaLabel')}>
                {primaryCta.label}
              </Link>
            )}
            {secondaryCta && (
              <Link href={secondaryCta.href} className={secondaryCtaCva({ color })} {...pa('secondaryCtaLabel')}>
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Visual panel — only rendered when a visual is provided ── */}
      {hasVisual && (
        <div className={`${visualPanelCva({ color })} ${visualPanelAnim}`} style={stagger(150)} {...pa('visual')}>
          {visual ?? (
            visualSrc ? (
              <Image
                src={visualSrc}
                alt={visualAlt}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className={`object-cover ${visualImgAnim}`}
                priority
              />
            ) : null
          )}
        </div>
      )}

    </section>
  );
}

// ─── Shared pieces for the alternate art directions ──────────────────────────────

type HeroDirectionProps = {
  eyebrow?: string;
  headline: string;
  body?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  visualSrc?: string;
  visualAlt?: string;
  visual?: ReactNode;
  color: NonNullable<HeroStyleOptions["color"]>;
  layout: NonNullable<HeroStyleOptions["layout"]>;
  animation: NonNullable<HeroStyleOptions["animation"]>;
  pa: NonNullable<HeroBlockProps["pa"]>;
};

/** Section ground fill by color — the palette modifier shared across directions. */
const groundCva = cva("", {
  variants: {
    color: { brand: "bg-brand-fill", canvas: "bg-canvas", surface: "bg-surface" },
  },
  defaultVariants: { color: "brand" },
});

/** Column-level entrance class (the alternate directions animate the content
 *  group rather than per-element, keeping each composition self-contained). */
function entranceClass(animation: HeroDirectionProps["animation"]): string {
  if (animation === "fade") return "motion-safe:animate-fade-in";
  if (animation === "slide" || animation === "parallax") return "motion-safe:animate-slide-up";
  return "";
}

function HeroMedia({
  visual, visualSrc, visualAlt, sizes, className = "object-cover",
}: {
  visual?: ReactNode; visualSrc?: string; visualAlt?: string; sizes: string; className?: string;
}) {
  if (visual) return <>{visual}</>;
  if (visualSrc) {
    return (
      <Image src={visualSrc} alt={visualAlt ?? ""} fill sizes={sizes} className={className} priority />
    );
  }
  return null;
}

function HeroCtas({
  color, primaryCta, secondaryCta, pa, className = "",
}: Pick<HeroDirectionProps, "color" | "primaryCta" | "secondaryCta" | "pa"> & { className?: string }) {
  if (!primaryCta && !secondaryCta) return null;
  return (
    <div className={`flex flex-wrap gap-sm ${className}`}>
      {primaryCta && (
        <Link href={primaryCta.href} className={primaryCtaCva({ color })} {...pa("primaryCtaLabel")}>
          {primaryCta.label}
        </Link>
      )}
      {secondaryCta && (
        <Link href={secondaryCta.href} className={secondaryCtaCva({ color })} {...pa("secondaryCtaLabel")}>
          {secondaryCta.label}
        </Link>
      )}
    </div>
  );
}

// ─── Direction: Spotlight ─────────────────────────────────────────────────────────
// A near-50/50 split, both panels matched to the same height — comparable to
// Diagonal's proportions — but with a distinct mechanic and voice: the image sits
// in an offset frame (a second bordered plate set behind it, no rotation) with a
// chromatic bloom shadow instead of Diagonal's full-bleed angled panel or
// Overlap's corner-pinned card, and the text uses a thin-but-large headline +
// medium-bold body instead of the shared extrabold/regular pairing. The section
// itself never takes the full-bleed color fill Diagonal uses — only the content
// panel does. "layout" places the image left/right; the panel takes the other side.

function SpotlightHero({
  eyebrow, headline, body, primaryCta, secondaryCta, visualSrc, visualAlt, visual, color, layout, animation, pa,
}: HeroDirectionProps) {
  const hasVisual = !!(visual || visualSrc);
  const anim = entranceClass(animation);
  const imageLeft = layout === "imageLeft";

  const card = (
    <div
      className={`hero-spotlight-card relative z-10 w-full rounded-ot-surface ${groundCva({ color })} p-lg lg:flex-1 lg:p-xl ${
        hasVisual ? (imageLeft ? "lg:order-2" : "lg:order-1") : ""
      } ${anim}`}
      data-theme={color === "brand" ? "dark" : undefined}
    >
      {eyebrow && (
        // Deliberate exception to the system's sharp-corner rule: a pill badge,
        // used only for this one label, never on buttons/cards/panels.
        <span
          className="mb-md inline-flex w-fit items-center rounded-full bg-accent px-sm py-1 text-label font-semibold uppercase tracking-label text-fg-on-accent"
          {...pa("eyebrow")}
        >
          {eyebrow}
        </span>
      )}
      {/* Thin-but-large headline + medium-bold body — the inverse weight pairing
          from Overlap/Diagonal's extrabold headline + regular body. */}
      <h1 className={spotlightHeadlineCva({ color })} {...pa("headline")}>{headline}</h1>
      {body && <p className={`${spotlightBodyCva({ color })} mt-sm`} {...pa("body")}>{body}</p>}
      <HeroCtas color={color} primaryCta={primaryCta} secondaryCta={secondaryCta} pa={pa} className="mt-md" />
    </div>
  );

  return (
    <section className="relative overflow-hidden bg-canvas px-md py-lg lg:px-lg lg:py-xl" aria-label="Hero">
      <div className="hero-spotlight-aura" aria-hidden />
      {hasVisual ? (
        // A fixed aspect ratio for the image scales WITH viewport width (wider
        // screen → taller image), while the card's height actually shrinks at
        // wider viewports as the headline wraps to fewer lines — the two drift
        // apart badly past ~1440px. Instead: the outer slot stretches to match
        // the card's real height (robust at any width), and only the visible
        // photo frame gets a small FIXED pixel overhang top/bottom — "slightly
        // taller" by a constant amount, not a ratio that compounds with width.
        // The row is width-capped and centered so the pair stays close on
        // ultrawide screens, and the photo slides a FIXED 56px under the card's
        // edge (no gap) so the two read as one composition.
        <div className="relative z-10 mx-auto flex w-full max-w-360 flex-col gap-lg lg:flex-row lg:items-center lg:gap-0">
          <div
            className={`relative w-full aspect-[4/3] lg:aspect-auto lg:flex-1 lg:self-stretch ${imageLeft ? "lg:order-1 lg:-mr-14" : "lg:order-2 lg:-ml-14"}`}
            {...pa("visual")}
          >
            {/* Offset frame: a second bordered plate set behind the photo, its own
                surface fill + brand-tinted ring, shifted a fixed amount so it peeks
                out on two sides — no rotation, no drop-shadow blur doing the work. */}
            <div
              className={`hero-spotlight-frame-offset absolute inset-0 lg:-top-3 lg:-bottom-3 rounded-ot-surface ${
                imageLeft ? "-translate-x-3 translate-y-3" : "translate-x-3 translate-y-3"
              }`}
              aria-hidden
            />
            <div className="hero-spotlight-frame absolute inset-0 lg:-top-3 lg:-bottom-3 overflow-hidden rounded-ot-surface">
              <HeroMedia visual={visual} visualSrc={visualSrc} visualAlt={visualAlt} sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          </div>
          {card}
        </div>
      ) : (
        // max-w-168 (42rem), not max-w-2xl — this project's --spacing-2xl
        // token (128px) shadows Tailwind's named max-width scale for every
        // key it defines (xs/sm/md/lg/xl/2xl), so max-w-2xl silently
        // resolves to 128px instead of 42rem. Bare numeric max-w-N avoids it.
        <div className="relative z-10 mx-auto w-full max-w-168">{card}</div>
      )}
    </section>
  );
}

// ─── Direction: Editorial Overlap ────────────────────────────────────────────────
// The image is given a fixed height and the plate a GUARANTEED-taller min-height
// (lg:h-88 vs lg:min-h-104 — 64px of headroom, not derived from copy length), so
// the shorter image always centers within the taller plate's vertical span and
// visibly overhangs top and bottom — the effect this direction is named for.
// Relying on actual content being long enough to naturally exceed the image's
// height would silently break with a short headline/no body; the min-height
// makes it structural instead of incidental. The index marker (mono label +
// accent rule) and extrabold headline are this direction's voice, distinct from
// Spotlight's pill badge + thin headline and Diagonal's angled seam.

function OverlapHero({
  eyebrow, headline, body, primaryCta, secondaryCta, visualSrc, visualAlt, visual, color, layout, animation, pa,
}: HeroDirectionProps) {
  const hasVisual = !!(visual || visualSrc);
  const anim = entranceClass(animation);
  const imageLeft = layout === "imageLeft";
  // The index marker must stay legible on a brand panel (and on custom brand
  // colors), so it uses the on-brand token there rather than the brand-hued muted.
  const markerColor = color === "brand" ? "text-fg-on-brand/70" : "text-fg-muted";

  const marker = (
    <p className={`mb-md flex items-center gap-sm font-mono text-label uppercase tracking-label ${markerColor}`} {...pa("eyebrow")}>
      <span className="inline-block h-px w-8 flex-none" style={{ background: "var(--ot-accent)" }} aria-hidden />
      {eyebrow ? eyebrow : "Hero"}
    </p>
  );

  if (!hasVisual) {
    return (
      <section className="bg-canvas px-md py-lg lg:px-lg lg:py-xl" aria-label="Hero">
        <div
          className={`hero-overlap-plate rounded-ot-surface relative mx-auto max-w-4xl ${groundCva({ color })} p-lg lg:p-2xl ${anim}`}
          data-theme={color === "brand" ? "dark" : undefined}
        >
          {marker}
          <h1 className={headlineCva({ color })} {...pa("headline")}>{headline}</h1>
          {body && <p className={`${bodyCva({ color })} mt-sm`} {...pa("body")}>{body}</p>}
          <HeroCtas color={color} primaryCta={primaryCta} secondaryCta={secondaryCta} pa={pa} className="mt-lg" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-canvas px-md py-lg lg:px-lg lg:py-xl" aria-label="Hero">
      <div className="relative z-10 flex flex-col gap-lg lg:flex-row lg:items-center lg:gap-0">
        <div
          className={`relative w-full aspect-[4/3] lg:aspect-auto lg:h-96 lg:flex-1 overflow-hidden rounded-ot-surface ${
            imageLeft ? "lg:order-1" : "lg:order-2"
          }`}
          {...pa("visual")}
        >
          <HeroMedia visual={visual} visualSrc={visualSrc} visualAlt={visualAlt} sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>

        {/* min-h-104 (26rem) guarantees this stays taller than the image's fixed
            h-96 (24rem) regardless of copy length — the overhang, and the
            "overlap" it reads as, never depends on content happening to run long.
            lg:-ml/-mr pulls it directly onto the image's edge (no gap) — a real
            overlap, not two adjacent panels — while staying a modest ~2rem so it
            reads as a raised plate, not a panel blocking the photo. */}
        <div
          className={`hero-overlap-plate rounded-ot-surface relative z-10 w-full lg:min-h-104 lg:flex-1 ${groundCva({ color })} p-lg lg:p-xl ${
            imageLeft ? "lg:order-2 lg:-ml-8" : "lg:order-1 lg:-mr-8"
          } ${anim}`}
          data-theme={color === "brand" ? "dark" : undefined}
        >
          {/* Subtle top-to-bottom shade for depth — neutral, not a brand/token
              color, so it reads the same across all three color variants. */}
          <div className="hero-overlap-shade" aria-hidden />
          <div className="relative z-10">
            {marker}
            <h1 className={headlineCva({ color })} {...pa("headline")}>{headline}</h1>
            {body && <p className={`${bodyCva({ color })} mt-sm`} {...pa("body")}>{body}</p>}
            <HeroCtas color={color} primaryCta={primaryCta} secondaryCta={secondaryCta} pa={pa} className="mt-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Direction: Diagonal Split ───────────────────────────────────────────────────
// A sharp diagonal seam between a solid color panel (text) and the image. The text
// always sits on an OPAQUE color panel — never floating over the photo — so it stays
// fully legible in every variant; the panel's diagonal edge is accent-lit (a token
// drop-shadow that follows the clip silhouette) with a soft brand bloom. Desktop: the
// image is full-bleed and the diagonal panel covers the text side. Mobile: the image
// is a top band with a diagonal bottom edge and the text sits on solid ground below.
// The photo is never behind the text, so it stays clear of the Banner. Height-stable.

function DiagonalHero({
  eyebrow, headline, body, primaryCta, secondaryCta, visualSrc, visualAlt, visual, color, layout, animation, pa,
}: HeroDirectionProps) {
  const hasVisual = !!(visual || visualSrc);
  const anim = entranceClass(animation);
  const side = layout === "imageLeft" ? "left" : "right";

  return (
    <section
      className={`${groundCva({ color })} relative overflow-hidden`}
      data-theme={color === "brand" ? "dark" : undefined}
      aria-label="Hero"
    >
      {hasVisual && (
        <>
          {/* Image: a clipped top band on mobile. On desktop it's a CONTAINED block
              pinned to the visible side (~46%, full height), so object-cover crops it
              around its own centre — the focal point shows, instead of the photo being
              stretched full-bleed across the section with its middle hidden. */}
          <div
            className={`hero-diagonal__media rounded-ot-surface relative h-60 w-full overflow-hidden lg:absolute lg:inset-y-0 lg:h-full lg:w-[46%] ${
              side === "left" ? "lg:left-0" : "lg:right-0"
            }`}
            {...pa("visual")}
          >
            <HeroMedia visual={visual} visualSrc={visualSrc} visualAlt={visualAlt} sizes="(min-width: 1024px) 46vw, 100vw" />
          </div>
          {/* Solid color panel (desktop only) — the readable text ground. It's the
              larger plane (~60%) and its angled edge OVERLAPS the contained image's
              near edge (Editorial-Overlap composition, but with a diagonal seam). The
              diagonal narrows it to ~56% at the bottom — still past the image's 54%
              edge, so the angle always sits over the photo with no gap. */}
          <div
            className={`hero-diagonal__panel absolute inset-y-0 z-[1] hidden w-[60%] lg:block ${groundCva({ color })} ${side === "left" ? "right-0" : "left-0"}`}
            data-side={side}
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex w-full items-center px-md py-lg lg:min-h-112 lg:px-lg lg:py-xl">
        <div
          className={`flex flex-col gap-md lg:gap-lg ${anim} ${
            hasVisual ? `lg:max-w-[52%] ${side === "left" ? "lg:ml-auto" : ""}` : "max-w-(--ot-measure)"
          }`}
        >
          {eyebrow && <p className={eyebrowCva({ color })} {...pa("eyebrow")}>{eyebrow}</p>}
          <h1 className={headlineCva({ color })} {...pa("headline")}>{headline}</h1>
          {body && <p className={bodyCva({ color })} {...pa("body")}>{body}</p>}
          <HeroCtas color={color} primaryCta={primaryCta} secondaryCta={secondaryCta} pa={pa} className="mt-sm" />
        </div>
      </div>
    </section>
  );
}
