// 勤怠チェック（遅刻・早退・退勤忘れ）と、外注の半日単位の稼働日数を判定する純粋関数。
// 従業員別勤怠カレンダー（管理者）と打刻カレンダー（従業員本人）の両方で使う。
// 時刻の比較はworkDate（日本時間0時の絶対時刻）からの経過分で行うため、サーバーの
// 実行タイムゾーンに依存しない。

// 所定の始業・終業時刻。曜日・祝日に関わらず同じ基準で判定する。
export const WORK_START = { hour: 7, minute: 30 };
export const WORK_END = { hour: 17, minute: 30 };
// 遅刻・早退の猶予（分）。始業+5分までの出勤、終業-5分以降の退勤は正常扱い。
export const GRACE_MINUTES = 5;

// 外注の半日判定に使う区切り。午前・午後それぞれの時間帯に少しでも稼働していれば
// その半日を稼働したとみなす（昼休憩12:00-13:00はどちらにも含めない）。
const MORNING_END_MINUTES = 12 * 60;
const AFTERNOON_START_MINUTES = 13 * 60;

const START_MINUTES = WORK_START.hour * 60 + WORK_START.minute;
const END_MINUTES = WORK_END.hour * 60 + WORK_END.minute;

export interface AttendanceEntry {
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
}

export type AttendanceStatus =
  | "none" // 打刻なし
  | "working" // 今日で、まだ退勤していない（勤務中）
  | "missingClockOut" // 過去の日で退勤の打刻がない
  | "normal"
  | "irregular"; // 遅刻・早退のいずれか（または両方）

export interface DayAttendance {
  status: AttendanceStatus;
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  lateMinutes: number; // 始業時刻からの遅れ（猶予内なら0）
  earlyLeaveMinutes: number; // 終業時刻より前に退勤した分（猶予内なら0）
}

// workDate（その日の日本時間0時）からの経過分。日付をまたいだ打刻（深夜退勤など）は
// 24時以降の値になるため、そのまま始業・終業時刻と比較できる。
function minutesSinceWorkDate(instant: Date, workDate: Date): number {
  return Math.floor((instant.getTime() - workDate.getTime()) / 60_000);
}

// 1日分（同じ人・同じworkDate）の打刻から、その日の勤怠状態を判定する。
// 複数の現場を回った日は、最初の出勤と最後の退勤で遅刻・早退を判定する。
export function judgeDay(entries: readonly AttendanceEntry[], isToday: boolean): DayAttendance {
  const clockIns = entries.flatMap((e) => (e.clockIn ? [e.clockIn] : []));
  const clockOuts = entries.flatMap((e) => (e.clockOut ? [e.clockOut] : []));
  const firstClockIn = clockIns.length ? new Date(Math.min(...clockIns.map((d) => d.getTime()))) : null;
  const lastClockOut = clockOuts.length ? new Date(Math.max(...clockOuts.map((d) => d.getTime()))) : null;

  if (entries.length === 0) {
    return { status: "none", firstClockIn, lastClockOut, lateMinutes: 0, earlyLeaveMinutes: 0 };
  }

  const workDate = entries[0].workDate;
  const lateBy = firstClockIn ? minutesSinceWorkDate(firstClockIn, workDate) - START_MINUTES : 0;
  const lateMinutes = lateBy > GRACE_MINUTES ? lateBy : 0;

  const hasOpenEntry = entries.some((e) => e.clockIn && !e.clockOut);
  if (hasOpenEntry) {
    return {
      status: isToday ? "working" : "missingClockOut",
      firstClockIn,
      lastClockOut,
      lateMinutes,
      earlyLeaveMinutes: 0,
    };
  }

  const earlyBy = lastClockOut ? END_MINUTES - minutesSinceWorkDate(lastClockOut, workDate) : 0;
  const earlyLeaveMinutes = earlyBy > GRACE_MINUTES ? earlyBy : 0;

  return {
    status: lateMinutes > 0 || earlyLeaveMinutes > 0 ? "irregular" : "normal",
    firstClockIn,
    lastClockOut,
    lateMinutes,
    earlyLeaveMinutes,
  };
}

// 外注の1日分の稼働日数（0 / 0.5 / 1）。午前・午後の両方に稼働していれば1日、
// 片方だけなら半日。退勤が未打刻の打刻は判定できないため数えない。
export function subcontractorDayUnits(entries: readonly AttendanceEntry[]): number {
  let morning = false;
  let afternoon = false;
  for (const e of entries) {
    if (!e.clockIn || !e.clockOut) continue;
    const start = minutesSinceWorkDate(e.clockIn, e.workDate);
    const end = minutesSinceWorkDate(e.clockOut, e.workDate);
    if (start < MORNING_END_MINUTES && end > START_MINUTES) morning = true;
    if (end > AFTERNOON_START_MINUTES) afternoon = true;
  }
  return (morning ? 0.5 : 0) + (afternoon ? 0.5 : 0);
}

// workDateごとに打刻をまとめる（キーはworkDateのgetTime()。calendar.tsのCalendarDay.dateと突き合わせる）。
export function groupByWorkDate<T extends AttendanceEntry>(entries: readonly T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const e of entries) {
    const key = e.workDate.getTime();
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

export interface AttendanceSummary {
  workedDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  missingClockOutCount: number;
}

export function summarizeAttendance(days: readonly DayAttendance[]): AttendanceSummary {
  return {
    workedDays: days.filter((d) => d.status !== "none").length,
    lateCount: days.filter((d) => d.lateMinutes > 0).length,
    earlyLeaveCount: days.filter((d) => d.earlyLeaveMinutes > 0).length,
    missingClockOutCount: days.filter((d) => d.status === "missingClockOut").length,
  };
}
