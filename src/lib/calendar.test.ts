import { describe, expect, it } from "vitest";
import { buildCalendarWeeks } from "./calendar";
import { jstMidnight, toJstInputValue } from "./jst-date";

describe("buildCalendarWeeks", () => {
  it("starts each week on Sunday and pads the leading/trailing days from adjacent months", () => {
    // 2026年8月1日は土曜日 -> 先頭週は日〜金が7月の埋め日、土だけ8月1日
    const weeks = buildCalendarWeeks(2026, 8, jstMidnight(2026, 8, 1));
    const firstWeek = weeks[0];
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek[0].dayOfWeek).toBe(0);
    expect(firstWeek[6].dayOfWeek).toBe(6);
    expect(firstWeek[6].inMonth).toBe(true);
    expect(firstWeek[6].day).toBe(1);
    expect(toJstInputValue(firstWeek[6].date)).toBe("2026-08-01");
    // 先頭6日は7月の埋め日
    for (let i = 0; i < 6; i++) {
      expect(firstWeek[i].inMonth).toBe(false);
    }
  });

  it("includes every day of the month exactly once and marked inMonth", () => {
    const weeks = buildCalendarWeeks(2026, 8, jstMidnight(2026, 8, 1));
    const inMonthDays = weeks.flat().filter((c) => c.inMonth);
    expect(inMonthDays).toHaveLength(31);
    expect(inMonthDays.map((c) => c.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("every week has exactly 7 days and the grid is a whole number of weeks", () => {
    const weeks = buildCalendarWeeks(2026, 2, jstMidnight(2026, 2, 1));
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    expect(weeks.flat().length % 7).toBe(0);
  });

  it("marks isToday correctly only for the matching date", () => {
    const today = jstMidnight(2026, 8, 15);
    const weeks = buildCalendarWeeks(2026, 8, today);
    const todayCells = weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].day).toBe(15);
    expect(todayCells[0].inMonth).toBe(true);
  });

  it("does not mark any day as today when today falls well outside the displayed grid", () => {
    const weeks = buildCalendarWeeks(2026, 8, jstMidnight(2026, 10, 15));
    expect(weeks.flat().some((c) => c.isToday)).toBe(false);
  });

  it("handles a month that starts on Sunday with no leading padding", () => {
    // 2026年11月1日は日曜日
    const weeks = buildCalendarWeeks(2026, 11, jstMidnight(2026, 11, 1));
    expect(weeks[0][0].inMonth).toBe(true);
    expect(weeks[0][0].day).toBe(1);
  });

  it("leading padding days belong to the previous month with correct dates", () => {
    const weeks = buildCalendarWeeks(2026, 8, jstMidnight(2026, 8, 1));
    const lastPaddingDay = weeks[0][5]; // 金曜、7月31日のはず
    expect(lastPaddingDay.inMonth).toBe(false);
    expect(toJstInputValue(lastPaddingDay.date)).toBe("2026-07-31");
  });
});
