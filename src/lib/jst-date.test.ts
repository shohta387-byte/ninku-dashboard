import { describe, expect, it } from "vitest";
import { currentBillingPeriod, jstMidnight, toJstInputValue } from "./jst-date";

function period(y: number, m: number, d: number) {
  const p = currentBillingPeriod(jstMidnight(y, m, d));
  return { from: toJstInputValue(p.from), to: toJstInputValue(p.to) };
}

describe("currentBillingPeriod", () => {
  it("day before the 21st belongs to the previous month's 21st cycle", () => {
    expect(period(2026, 8, 4)).toEqual({ from: "2026-07-21", to: "2026-08-20" });
  });

  it("the 20th itself is still the end of the current cycle", () => {
    expect(period(2026, 8, 20)).toEqual({ from: "2026-07-21", to: "2026-08-20" });
  });

  it("the 21st starts a new cycle", () => {
    expect(period(2026, 8, 21)).toEqual({ from: "2026-08-21", to: "2026-09-20" });
  });

  it("handles a December -> January year rollover", () => {
    expect(period(2026, 1, 5)).toEqual({ from: "2025-12-21", to: "2026-01-20" });
  });

  it("handles a January -> February start with no year change", () => {
    expect(period(2026, 1, 25)).toEqual({ from: "2026-01-21", to: "2026-02-20" });
  });
});
