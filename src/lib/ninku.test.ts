import { describe, expect, it } from "vitest";
import {
  calculateNinkuForEntry,
  calculateNinkuFromHours,
  computeWorkedHours,
  getBreakWindowsWithinSpan,
} from "./ninku";

function time(hour: number, minute: number): Date {
  return new Date(2026, 0, 1, hour, minute, 0, 0);
}

const workDate = new Date(2026, 0, 1);

describe("computeWorkedHours", () => {
  it("07:30-17:30 -> 8h (standard full day)", () => {
    expect(computeWorkedHours(time(7, 30), time(17, 30))).toBe(8);
  });

  it("07:30-19:30 -> 10h (2h overtime)", () => {
    expect(computeWorkedHours(time(7, 30), time(19, 30))).toBe(10);
  });

  it("08:00-12:00 -> 2h (4h span minus flat 2h break)", () => {
    expect(computeWorkedHours(time(8, 0), time(12, 0))).toBe(2);
  });

  it("09:00-09:30 -> 0h (clamped at zero, span shorter than break)", () => {
    expect(computeWorkedHours(time(9, 0), time(9, 30))).toBe(0);
  });

  it("07:15-17:30 -> 8h (07:15 rounds to 07:30)", () => {
    expect(computeWorkedHours(time(7, 15), time(17, 30))).toBe(8);
  });

  it("throws when clockOut is not after clockIn", () => {
    expect(() => computeWorkedHours(time(17, 30), time(7, 30))).toThrow();
  });

  it("07:30-17:30 with break2 worked -> 9h (lunch break counted as worked)", () => {
    expect(computeWorkedHours(time(7, 30), time(17, 30), ["break2"])).toBe(9);
  });

  it("07:30-17:30 with all breaks worked -> 10h (span minus 0)", () => {
    expect(computeWorkedHours(time(7, 30), time(17, 30), ["break1", "break2", "break3"])).toBe(10);
  });

  it("08:00-12:00 with break1 worked -> 2.5h (only break1's 0.5h added back)", () => {
    expect(computeWorkedHours(time(8, 0), time(12, 0), ["break1"])).toBe(2.5);
  });

  it("10:00-10:05 -> 0h (valid order, but rounds into the same half-hour bucket)", () => {
    expect(computeWorkedHours(time(10, 0), time(10, 5))).toBe(0);
  });
});

describe("calculateNinkuFromHours", () => {
  it("8h -> 1.0", () => {
    const r = calculateNinkuFromHours(8);
    expect(r.regularHours).toBe(8);
    expect(r.overtimeHours).toBe(0);
    expect(r.totalNinku).toBeCloseTo(1.0, 10);
  });

  it("4h -> 0.5", () => {
    const r = calculateNinkuFromHours(4);
    expect(r.totalNinku).toBeCloseTo(0.5, 10);
  });

  it("0.5h -> 0.0625", () => {
    const r = calculateNinkuFromHours(0.5);
    expect(r.totalNinku).toBeCloseTo(0.0625, 10);
  });

  it("0h -> 0", () => {
    const r = calculateNinkuFromHours(0);
    expect(r.totalNinku).toBe(0);
  });

  it("9h -> 1.15625 (1h overtime at 1.25x)", () => {
    const r = calculateNinkuFromHours(9);
    expect(r.regularHours).toBe(8);
    expect(r.overtimeHours).toBe(1);
    expect(r.totalNinku).toBeCloseTo(1.15625, 10);
  });

  it("10h -> 1.3125 (2h overtime at 1.25x)", () => {
    const r = calculateNinkuFromHours(10);
    expect(r.totalNinku).toBeCloseTo(1.3125, 10);
  });

  it("8.5h -> 1.078125 (0.5h overtime at 1.25x)", () => {
    const r = calculateNinkuFromHours(8.5);
    expect(r.totalNinku).toBeCloseTo(1.078125, 10);
  });

  it("throws for negative hours", () => {
    expect(() => calculateNinkuFromHours(-1)).toThrow();
  });
});

describe("calculateNinkuForEntry", () => {
  it("07:30-17:30 -> totalNinku 1.0", () => {
    expect(calculateNinkuForEntry(time(7, 30), time(17, 30)).totalNinku).toBeCloseTo(1.0, 10);
  });

  it("07:30-19:30 -> totalNinku 1.3125", () => {
    expect(calculateNinkuForEntry(time(7, 30), time(19, 30)).totalNinku).toBeCloseTo(1.3125, 10);
  });
});

describe("getBreakWindowsWithinSpan", () => {
  it("07:30-17:30 -> all 3 breaks are within the span", () => {
    const keys = getBreakWindowsWithinSpan(workDate, time(7, 30), time(17, 30)).map((w) => w.key);
    expect(keys).toEqual(["break1", "break2", "break3"]);
  });

  it("14:00-18:00 -> only break3 (15:00-15:30) is within the span", () => {
    const keys = getBreakWindowsWithinSpan(workDate, time(14, 0), time(18, 0)).map((w) => w.key);
    expect(keys).toEqual(["break3"]);
  });

  it("09:00-11:45 -> only break1 (10:00-10:30) is fully within the span", () => {
    const keys = getBreakWindowsWithinSpan(workDate, time(9, 0), time(11, 45)).map((w) => w.key);
    expect(keys).toEqual(["break1"]);
  });

  it("12:30-13:00 -> break2 (12:00-13:00) is NOT within the span (starts before clockIn)", () => {
    const keys = getBreakWindowsWithinSpan(workDate, time(12, 30), time(13, 0)).map((w) => w.key);
    expect(keys).toEqual([]);
  });

  it("08:00-09:00 -> no breaks within the span", () => {
    expect(getBreakWindowsWithinSpan(workDate, time(8, 0), time(9, 0))).toEqual([]);
  });
});
