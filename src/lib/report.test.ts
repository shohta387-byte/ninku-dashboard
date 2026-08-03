import { describe, expect, it } from "vitest";
import {
  dayKey,
  monthKey,
  summarizeByEmployee,
  summarizeByPeriod,
  sumNinku,
  toReportEntry,
  weekKey,
  type ReportSourceEntry,
} from "./report";

function makeEntry(overrides: Partial<ReportSourceEntry> = {}): ReportSourceEntry {
  return {
    id: "entry-1",
    employeeId: "emp-1",
    employeeName: "山田 太郎",
    siteId: "site-1",
    siteName: "新宿現場",
    workDate: new Date(2026, 7, 3),
    clockIn: new Date(2026, 7, 3, 7, 30),
    clockOut: new Date(2026, 7, 3, 17, 30),
    workedBreak1: false,
    workedBreak2: false,
    workedBreak3: false,
    ...overrides,
  };
}

describe("dayKey / weekKey / monthKey", () => {
  it("dayKey formats as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 7, 3))).toBe("2026-08-03");
  });

  it("monthKey formats as YYYY-MM", () => {
    expect(monthKey(new Date(2026, 7, 3))).toBe("2026-08");
  });

  it("weekKey resolves to the Monday of that week", () => {
    // 2026-08-03 is a Monday
    expect(weekKey(new Date(2026, 7, 3))).toBe("2026-08-03");
    // 2026-08-09 is a Sunday, same week as the Monday above
    expect(weekKey(new Date(2026, 7, 9))).toBe("2026-08-03");
    // 2026-08-10 is the next Monday
    expect(weekKey(new Date(2026, 7, 10))).toBe("2026-08-10");
  });
});

describe("summarizeByPeriod", () => {
  it("sums total_ninku per day across multiple entries", () => {
    const entries = [
      toReportEntry(makeEntry({ id: "a" })),
      toReportEntry(
        makeEntry({
          id: "b",
          workDate: new Date(2026, 7, 3),
          clockIn: new Date(2026, 7, 3, 7, 30),
          clockOut: new Date(2026, 7, 3, 12, 0),
        }),
      ),
      toReportEntry(
        makeEntry({
          id: "c",
          workDate: new Date(2026, 7, 4),
        }),
      ),
    ];

    const byDay = summarizeByPeriod(entries, "day");
    expect(byDay).toHaveLength(2);
    expect(byDay[0].key).toBe("2026-08-03");
    expect(byDay[0].entryCount).toBe(2);
    // a: 07:30-17:30 -> 8h worked -> 1.0ninku。b: 07:30-12:00 -> 4.5h span-2h休憩=2.5h -> 0.3125ninku
    expect(byDay[0].totalNinku).toBeCloseTo(1.0 + 0.3125, 10);
    expect(byDay[1].key).toBe("2026-08-04");
  });
});

describe("summarizeByEmployee", () => {
  it("groups by employee and sorts descending by total ninku", () => {
    const entries = [
      toReportEntry(makeEntry({ employeeId: "emp-1", employeeName: "山田 太郎" })),
      toReportEntry(
        makeEntry({
          employeeId: "emp-2",
          employeeName: "佐藤 次郎",
          clockIn: new Date(2026, 7, 3, 7, 30),
          clockOut: new Date(2026, 7, 3, 9, 30),
        }),
      ),
    ];

    const byEmployee = summarizeByEmployee(entries);
    expect(byEmployee[0].employeeName).toBe("山田 太郎");
    expect(byEmployee[0].totalNinku).toBeCloseTo(1.0, 10);
    expect(byEmployee[1].employeeName).toBe("佐藤 次郎");
  });
});

describe("sumNinku", () => {
  it("sums total ninku across all entries", () => {
    const entries = [toReportEntry(makeEntry()), toReportEntry(makeEntry())];
    expect(sumNinku(entries)).toBeCloseTo(2.0, 10);
  });
});
