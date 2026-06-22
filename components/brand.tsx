import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Two stacked, slightly-askew scene cards with a pen stroke — "a vault of
 * drawings." Strokes use currentColor; the nib pops in the brand violet.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <rect
        x="7.5"
        y="9"
        width="18"
        height="15"
        rx="3"
        transform="rotate(-6 16 16)"
        className="fill-background"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="6"
        y="7.5"
        width="18"
        height="15"
        rx="3"
        transform="rotate(5 15 15)"
        className="fill-background"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M10.5 13.5c2.3-1.1 4.2-.2 6 .4 1.6.6 3.4.9 5-.4"
        stroke="var(--primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M21.5 6.2c.6.7 1.4 1.2 2.4 1.3-.9.4-1.5 1.1-1.8 2-.3-.9-.9-1.6-1.8-2 1-.2 1.6-.7 1.2-1.3Z"
        fill="var(--primary)"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  href = "/",
  iconClassName,
}: {
  className?: string;
  href?: string | null;
  iconClassName?: string;
}) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight",
        className,
      )}
    >
      <LogoMark className={iconClassName} />
      SceneVault
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}

/** A felt-tip squiggle that draws itself in under a word. */
export function ScribbleUnderline({
  className,
  dash = 360,
}: {
  className?: string;
  dash?: number;
}) {
  return (
    <svg
      viewBox="0 0 300 24"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("absolute -bottom-2 left-0 w-full", className)}
    >
      <path
        d="M4 15c46-9 96-11 150-9 38 1 78 4 142 12"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        className="animate-draw"
        style={{ ["--dash" as string]: String(dash) }}
      />
    </svg>
  );
}

/** A loose marker circle drawn around a word for emphasis. */
export function MarkerCircle({
  className,
  dash = 520,
}: {
  className?: string;
  dash?: number;
}) {
  return (
    <svg
      viewBox="0 0 240 90"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -inset-x-3 -inset-y-2",
        className,
      )}
    >
      <path
        d="M150 8c-52-6-118-2-135 22-13 19 19 38 86 44 60 5 128-3 132-30 3-19-38-33-99-37"
        stroke="var(--chart-2)"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="animate-draw"
        style={{ ["--dash" as string]: String(dash) }}
      />
    </svg>
  );
}
