import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/relative-time";

const now = 1_700_000_000_000;
const sec = 1000;
const min = 60 * sec;
const hr = 60 * min;
const day = 24 * hr;

describe("formatRelativeTime", () => {
  it("handles missing timestamps", () => {
    expect(formatRelativeTime(null, now)).toBe("never");
    expect(formatRelativeTime(undefined, now)).toBe("never");
    expect(formatRelativeTime(0, now)).toBe("never");
  });

  it("reads anything within the last 45s as just now", () => {
    expect(formatRelativeTime(now, now)).toBe("just now");
    expect(formatRelativeTime(now - 44 * sec, now)).toBe("just now");
  });

  it("steps through minutes, hours, and days", () => {
    expect(formatRelativeTime(now - 12 * min, now)).toBe("12m ago");
    expect(formatRelativeTime(now - 2 * hr, now)).toBe("2h ago");
    expect(formatRelativeTime(now - 3 * day, now)).toBe("3d ago");
  });

  it("rolls up into weeks, months, and years", () => {
    expect(formatRelativeTime(now - 14 * day, now)).toBe("2w ago");
    expect(formatRelativeTime(now - 60 * day, now)).toBe("2mo ago");
    expect(formatRelativeTime(now - 400 * day, now)).toBe("1y ago");
  });

  it("never reports negative time for future-ish clock skew", () => {
    expect(formatRelativeTime(now + 5 * sec, now)).toBe("just now");
  });
});
