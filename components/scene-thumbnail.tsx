"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Doodle fallback for scenes without a rendered preview (never saved, empty, or
 * a thumbnail that failed to load). Chosen deterministically from the scene id
 * so it's stable across renders and varied across the grid.
 */
const DOODLES: React.ReactNode[] = [
  // flow
  <>
    <rect x="14" y="18" width="34" height="20" rx="3" />
    <rect x="78" y="18" width="34" height="20" rx="3" />
    <rect x="46" y="54" width="34" height="20" rx="3" />
    <path d="M48 28h30M63 38v16M78 38 64 54" />
  </>,
  // wireframe
  <>
    <rect x="16" y="14" width="94" height="64" rx="3" />
    <path d="M16 30h94M26 42h44M26 52h58M26 62h34" />
  </>,
  // mind map
  <>
    <circle cx="63" cy="46" r="14" />
    <circle cx="24" cy="22" r="8" />
    <circle cx="104" cy="24" r="8" />
    <circle cx="98" cy="70" r="8" />
    <path d="m50 38-19-11M76 39l21-12M73 56l19 9" />
  </>,
  // chart
  <>
    <path d="M18 70h92M18 70V20" />
    <rect x="30" y="48" width="13" height="22" />
    <rect x="52" y="36" width="13" height="34" />
    <rect x="74" y="26" width="13" height="44" />
    <rect x="96" y="44" width="13" height="26" />
  </>,
  // sketch scribble
  <>
    <path d="M20 56c10-26 24-26 30-8s18 20 28-2 22-18 28 4" />
    <circle cx="34" cy="30" r="6" />
    <rect x="84" y="20" width="18" height="14" rx="2" />
  </>,
];

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function SceneThumbnail({
  seed,
  src,
  className,
}: {
  seed: string;
  /** Rendered preview URL; falls back to the doodle when absent or broken. */
  src?: string;
  className?: string;
}) {
  // Track which src failed rather than a boolean, so a new save (which changes
  // the version query param) automatically retries the image without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && failedSrc !== src) {
    return (
      <div className={cn("bg-paper-dots overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
          onError={() => setFailedSrc(src)}
        />
      </div>
    );
  }

  const h = hash(seed);
  const doodle = DOODLES[h % DOODLES.length];
  const color = COLORS[(h >> 3) % COLORS.length];

  return (
    <div
      className={cn(
        "bg-paper-dots flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <svg
        viewBox="0 0 128 92"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[62%] w-[72%]"
      >
        {doodle}
      </svg>
    </div>
  );
}
