import { describe, expect, it } from "vitest";
import { currentBillingPeriod, jstMidnight, jstMonthRange, shiftJstMonth, toJstInputValue } from "./jst-date";

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

describe("jstMonthRange", () => {
  it("returns the 1st through the last day of a 31-day month", () => {
    const r = jstMonthRange(2026, 8);
    expect(toJstInputValue(r.from)).toBe("2026-08-01");
    expect(toJstInputValue(r.to)).toBe("2026-08-31");
  });

  it("returns the correct last day for a 30-day month", () => {
    const r = jstMonthRange(2026, 4);
    expect(toJstInputValue(r.to)).toBe("2026-04-30");
  });

  it("handles February in a non-leap year", () => {
    const r = jstMonthRange(2026, 2);
    expect(toJstInputValue(r.to)).toBe("2026-02-28");
  });

  it("handles February in a leap year", () => {
    const r = jstMonthRange(2028, 2);
    expect(toJstInputValue(r.to)).toBe("2028-02-29");
  });
});

describe("shiftJstMonth", () => {
  it("moves forward within the same year", () => {
    expect(shiftJstMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
  });

  it("moves backward within the same year", () => {
    expect(shiftJstMonth(2026, 8, -1)).toEqual({ year: 2026, month: 7 });
  });

  it("rolls over into the next year from December", () => {
    expect(shiftJstMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls back into the previous year from January", () => {
    expect(shiftJstMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("handles multi-month jumps", () => {
    expect(shiftJstMonth(2026, 11, 3)).toEqual({ year: 2027, month: 2 });
  });
});
