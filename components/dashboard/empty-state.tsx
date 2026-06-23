import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sketch-edge flex flex-col items-center justify-center gap-3 rounded-xl border-dashed bg-card/40 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="font-display text-base font-bold">{title}</p>
        {hint ? (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
