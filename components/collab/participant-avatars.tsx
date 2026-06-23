import type { Participant } from "@/components/collab/use-room";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({ participant }: { participant: Participant }) {
  return (
    <div
      className="flex size-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: participant.color }}
      title={
        participant.isSelf ? `${participant.name} (you)` : participant.name
      }
    >
      {initials(participant.name)}
    </div>
  );
}
