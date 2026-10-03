import { describe, expect, it } from "vitest";
import { judgeDay, subcontractorDayUnits, summarizeAttendance } from "./attendance";
import { fromJstParts, jstMidnight } from "./jst-date";

const workDate = jstMidnight(2026, 9, 1);
const at = (hour: number, minute: number) => fromJstParts(2026, 9, 1, hour, minute);
const entry = (clockIn: Date | null, clockOut: Date | null) => ({ workDate, clockIn, clockOut });

describe("judgeDay", () => {
  it("returns none when there are no entries", () => {
    expect(judgeDay([], false).status).toBe("none");
  });

  it("treats arrival within the 5-minute grace as on time", () => {
    const result = judgeDay([entry(at(7, 35), at(17, 30))], false);
    expect(result.status).toBe("normal");
    expect(result.lateMinutes).toBe(0);
  });

  it("flags arrival after the grace period as late with minutes from 7:30", () => {
    const result = judgeDay([entry(at(7, 36), at(17, 30))], false);
    expect(result.status).toBe("irregular");
    expect(result.lateMinutes).toBe(6);
  });

  it("treats leaving within the 5-minute grace as normal", () => {
    expect(judgeDay([entry(at(7, 30), at(17, 25))], false).status).toBe("normal");
  });

  it("flags leaving before the grace period as early leave", () => {
    const result = judgeDay([entry(at(7, 30), at(17, 24))], false);
    expect(result.status).toBe("irregular");
    expect(result.earlyLeaveMinutes).toBe(6);
  });

  it("uses the first clock-in and last clock-out across multiple sites", () => {
    const result = judgeDay([entry(at(13, 0), at(17, 30)), entry(at(7, 30), at(13, 0))], false);
    expect(result.status).toBe("normal");
    expect(result.firstClockIn).toEqual(at(7, 30));
    expect(result.lastClockOut).toEqual(at(17, 30));
  });

  it("treats a clock-out after midnight as later than 17:30", () => {
    const nextDay = fromJstParts(2026, 9, 2, 1, 0);
    expect(judgeDay([entry(at(7, 30), nextDay)], false).status).toBe("normal");
  });

  it("flags a missing clock-out on a past day", () => {
    expect(judgeDay([entry(at(7, 30), null)], false).status).toBe("missingClockOut");
  });

  it("treats a missing clock-out today as still working", () => {
    expect(judgeDay([entry(at(7, 30), null)], true).status).toBe("working");
  });

  it("still reports lateness on a day with a missing clock-out", () => {
    expect(judgeDay([entry(at(8, 0), null)], false).lateMinutes).toBe(30);
  });
});

describe("subcontractorDayUnits", () => {
  it("counts a full day when working both morning and afternoon", () => {
    expect(subcontractorDayUnits([entry(at(8, 0), at(17, 0))])).toBe(1);
  });

  it("counts a half day for morning only", () => {
    expect(subcontractorDayUnits([entry(at(8, 0), at(12, 0))])).toBe(0.5);
  });

  it("counts a half day for afternoon only", () => {
    expect(subcontractorDayUnits([entry(at(13, 0), at(17, 30))])).toBe(0.5);
  });

  it("combines morning and afternoon entries at different sites into a full day", () => {
    expect(subcontractorDayUnits([entry(at(8, 0), at(12, 0)), entry(at(13, 0), at(17, 0))])).toBe(1);
  });

  it("ignores entries without a clock-out", () => {
    expect(subcontractorDayUnits([entry(at(8, 0), null)])).toBe(0);
  });
});

describe("summarizeAttendance", () => {
  it("counts worked days, lateness, early leave and missing clock-outs", () => {
    const days = [
      judgeDay([entry(at(7, 30), at(17, 30))], false),
      judgeDay([entry(at(8, 0), at(16, 0))], false),
      judgeDay([entry(at(7, 30), null)], false),
      judgeDay([], false),
    ];
    expect(summarizeAttendance(days)).toEqual({
      workedDays: 3,
      lateCount: 1,
      earlyLeaveCount: 1,
      missingClockOutCount: 1,
    });
  });
});
