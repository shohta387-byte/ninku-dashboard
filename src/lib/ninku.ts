export const STANDARD_WORK_HOURS = 8;
export const TIME_STEP_MINUTES = 10;
export const TIME_STEP_HOURS = TIME_STEP_MINUTES / 60; // 1/6
export const NINKU_PER_HOUR = 1 / 8; // 0.125
export const OVERTIME_MULTIPLIER = 1.25;

export type BreakKey = "break1" | "break2" | "break3";

export interface BreakWindow {
  key: BreakKey;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

// 定時休憩。休憩が取れず稼働した場合は、その枠を workedBreakKeys に含めることで
// 稼働時間・人工の計算に加算する（枠の途中出勤・途中退勤は現時点では想定しない）。
export const BREAK_WINDOWS: readonly BreakWindow[] = [
  { key: "break1", label: "10:00-10:30", startHour: 10, startMinute: 0, endHour: 10, endMinute: 30 },
  { key: "break2", label: "12:00-13:00", startHour: 12, startMinute: 0, endHour: 13, endMinute: 0 },
  { key: "break3", label: "15:00-15:30", startHour: 15, startMinute: 0, endHour: 15, endMinute: 30 },
];

function breakWindowHours(w: BreakWindow): number {
  return (w.endHour * 60 + w.endMinute - (w.startHour * 60 + w.startMinute)) / 60;
}

export const BREAK_HOURS = BREAK_WINDOWS.reduce((sum, w) => sum + breakWindowHours(w), 0);

function breakWindowStart(w: BreakWindow, workDate: Date): Date {
  const d = new Date(workDate);
  d.setHours(w.startHour, w.startMinute, 0, 0);
  return d;
}

function breakWindowEnd(w: BreakWindow, workDate: Date): Date {
  const d = new Date(workDate);
  d.setHours(w.endHour, w.endMinute, 0, 0);
  return d;
}

// 実際の勤務時間（clockIn〜clockOut）に完全に含まれている休憩枠だけを返す。
// 「休憩なしで稼働した」チェックは、実際に働いていた時間帯の休憩にしか意味がないため、
// 打刻時刻の外側にある休憩枠はチェック対象から除外する。
export function getBreakWindowsWithinSpan(
  workDate: Date,
  clockIn: Date,
  clockOut: Date,
): BreakWindow[] {
  return BREAK_WINDOWS.filter((w) => {
    const start = breakWindowStart(w, workDate);
    const end = breakWindowEnd(w, workDate);
    return start >= clockIn && end <= clockOut;
  });
}

export function roundToTimeStep(date: Date): Date {
  const stepMs = TIME_STEP_MINUTES * 60 * 1000;
  return new Date(Math.round(date.getTime() / stepMs) * stepMs);
}

export function computeWorkedHours(
  clockIn: Date,
  clockOut: Date,
  workedBreakKeys: readonly BreakKey[] = [],
): number {
  if (clockOut <= clockIn) {
    throw new Error("clockOut must be after clockIn");
  }
  const inR = roundToTimeStep(clockIn);
  const outR = roundToTimeStep(clockOut);
  // 丸め後に同じ枠へ収まる短時間の勤務（例: 09:00-09:05）は、順序としては正当なので
  // エラーにはせず稼働時間0として扱う。
  const spanHours = Math.max(0, (outR.getTime() - inR.getTime()) / 3_600_000);
  const unpaidBreakHours = BREAK_WINDOWS.filter((w) => !workedBreakKeys.includes(w.key)).reduce(
    (sum, w) => sum + breakWindowHours(w),
    0,
  );
  return Math.max(0, spanHours - unpaidBreakHours);
}

export interface NinkuResult {
  workedHours: number;
  regularHours: number;
  overtimeHours: number;
  regularNinku: number;
  overtimeNinku: number;
  totalNinku: number;
}

// 人工は1.25倍の残業係数がかかるため、桁の細かい値になりやすい（例: 3.828125）。
// また稼働時間も10分刻み(1/6時間)で計算するため、丸めないと6.6666666666667hのような
// 割り切れない小数になってしまう。実務上意味のある桁数ではないため、表示・集計・CSV・
// BigQuery連携も含めてこの計算結果を使うすべての箇所で読みやすい小数第2位に丸めておく。
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const roundNinku = round2;
export const roundHours = round2;

export function calculateNinkuFromHours(workedHours: number): NinkuResult {
  if (workedHours < 0) {
    throw new Error("workedHours cannot be negative");
  }

  const stepUnits = Math.round(workedHours / TIME_STEP_HOURS);
  const standardUnits = Math.round(STANDARD_WORK_HOURS / TIME_STEP_HOURS); // 48
  const regularUnits = Math.min(stepUnits, standardUnits);
  const overtimeUnits = Math.max(0, stepUnits - standardUnits);
  const ninkuPerStep = NINKU_PER_HOUR * TIME_STEP_HOURS; // 1/48

  const regularNinku = roundNinku(regularUnits * ninkuPerStep);
  const overtimeNinku = roundNinku(overtimeUnits * ninkuPerStep * OVERTIME_MULTIPLIER);

  return {
    workedHours: roundHours(stepUnits * TIME_STEP_HOURS),
    regularHours: roundHours(regularUnits * TIME_STEP_HOURS),
    overtimeHours: roundHours(overtimeUnits * TIME_STEP_HOURS),
    regularNinku,
    overtimeNinku,
    totalNinku: roundNinku(regularNinku + overtimeNinku),
  };
}

export function calculateNinkuForEntry(
  clockIn: Date,
  clockOut: Date,
  workedBreakKeys: readonly BreakKey[] = [],
): NinkuResult {
  return calculateNinkuFromHours(computeWorkedHours(clockIn, clockOut, workedBreakKeys));
}

// TimeEntryのworkedBreak1/2/3フィールドから、チェックされている休憩キーの配列を組み立てる。
export function getWorkedBreakKeysFromEntry(entry: {
  workedBreak1: boolean;
  workedBreak2: boolean;
  workedBreak3: boolean;
}): BreakKey[] {
  return [
    entry.workedBreak1 && "break1",
    entry.workedBreak2 && "break2",
    entry.workedBreak3 && "break3",
  ].filter((key): key is BreakKey => key !== false);
}
