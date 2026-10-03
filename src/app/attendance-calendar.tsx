import Link from "next/link";
import { WEEKDAY_LABELS_JA, type CalendarDay } from "@/lib/calendar";
import { formatJstTime, toJstInputValue } from "@/lib/jst-date";
import type { DayAttendance } from "@/lib/attendance";

// 1日分のセルに出す内容。従業員は勤怠状態（遅刻・早退など）、外注は半日単位の稼働日数を出す。
export type AttendanceCell =
  | { kind: "employee"; day: DayAttendance }
  | { kind: "subcontractor"; units: number; hasOpenEntry: boolean };

type Tone = "empty" | "normal" | "warning" | "alert" | "working";

const TONE_CLASSES: Record<Tone, string> = {
  empty: "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900",
  normal: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
  warning: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
  alert: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950",
  working: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950",
};

const BADGE_CLASSES: Record<Tone, string> = {
  empty: "",
  normal: "bg-blue-600 text-white",
  warning: "bg-yellow-500 text-white",
  alert: "bg-red-600 text-white",
  working: "bg-green-600 text-white",
};

function hhmm(date: Date | null): string {
  return date ? formatJstTime(date, { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

function describeCell(cell: AttendanceCell | undefined): { tone: Tone; badge: string; times: string[] } {
  if (!cell) return { tone: "empty", badge: "", times: [] };

  if (cell.kind === "subcontractor") {
    if (cell.hasOpenEntry && cell.units === 0) return { tone: "alert", badge: "退勤なし", times: [] };
    if (cell.units === 0) return { tone: "empty", badge: "", times: [] };
    return { tone: cell.hasOpenEntry ? "alert" : "normal", badge: `${cell.units}日`, times: [] };
  }

  const { day } = cell;
  const times = day.status === "none" ? [] : [hhmm(day.firstClockIn), hhmm(day.lastClockOut)];
  switch (day.status) {
    case "none":
      return { tone: "empty", badge: "", times };
    case "working":
      return { tone: "working", badge: day.lateMinutes > 0 ? "遅刻" : "勤務中", times };
    case "missingClockOut":
      return { tone: "alert", badge: "退勤なし", times };
    case "normal":
      return { tone: "normal", badge: "出勤", times };
    case "irregular": {
      const labels = [day.lateMinutes > 0 && "遅刻", day.earlyLeaveMinutes > 0 && "早退"].filter(Boolean);
      return { tone: "warning", badge: labels.join("・"), times };
    }
  }
}

// 従業員別勤怠（管理者）・打刻カレンダー（従業員本人）で使う、勤怠状態を色分けした
// カレンダー。前後の期間への移動リンクは呼び出し側で組み立てて渡す（月単位・締め期間単位の
// どちらにも使えるようにするため）。
export function AttendanceCalendar({
  title,
  weeks,
  cells,
  dayHref,
  prevHref,
  nextHref,
}: {
  title: string;
  weeks: CalendarDay[][];
  cells: Map<number, AttendanceCell>;
  dayHref: (dateStr: string) => string;
  prevHref: string;
  nextHref: string | null;
}) {
  const navClass =
    "rounded-lg border border-black/10 px-3 py-2 text-sm font-bold active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={prevHref} className={navClass}>
          ← 前へ
        </Link>
        <p className="text-center font-bold">{title}</p>
        {nextHref ? (
          <Link href={nextHref} className={navClass}>
            次へ →
          </Link>
        ) : (
          <span className="rounded-lg border border-black/5 px-3 py-2 text-sm font-bold text-zinc-300 dark:border-white/5 dark:text-zinc-700">
            次へ →
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
        {WEEKDAY_LABELS_JA.map((label, i) => (
          <div key={label} className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500"}>
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => (
          <DayCell key={day.date.getTime()} day={day} cell={cells.get(day.date.getTime())} dayHref={dayHref} />
        ))}
      </div>

      <Legend />
    </div>
  );
}

function DayCell({
  day,
  cell,
  dayHref,
}: {
  day: CalendarDay;
  cell: AttendanceCell | undefined;
  dayHref: (dateStr: string) => string;
}) {
  if (!day.inMonth) {
    return (
      <div className="flex min-h-16 items-start justify-center rounded-lg p-1 text-xs text-zinc-300 dark:text-zinc-700">
        {day.day}
      </div>
    );
  }

  const { tone, badge, times } = describeCell(cell);
  const weekdayColor = day.dayOfWeek === 0 ? "text-red-500" : day.dayOfWeek === 6 ? "text-blue-500" : "";

  return (
    <Link
      href={dayHref(toJstInputValue(day.date))}
      className={`flex min-h-16 flex-col items-center gap-0.5 rounded-lg border p-1 text-xs active:opacity-70 ${
        TONE_CLASSES[tone]
      } ${day.isToday ? "outline-2 outline-blue-600" : ""}`}
    >
      <span className={`font-bold ${weekdayColor}`}>{day.day}</span>
      {badge && (
        <span className={`rounded-full px-1 py-0.5 text-[10px] font-bold leading-none ${BADGE_CLASSES[tone]}`}>
          {badge}
        </span>
      )}
      {times.map((t, i) => (
        <span key={i} className="text-[10px] leading-none text-zinc-600 tabular-nums dark:text-zinc-400">
          {t}
        </span>
      ))}
    </Link>
  );
}

function Legend() {
  const items: { tone: Tone; label: string }[] = [
    { tone: "normal", label: "出勤" },
    { tone: "warning", label: "遅刻・早退" },
    { tone: "alert", label: "退勤なし（要確認）" },
    { tone: "working", label: "勤務中" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
      {items.map((item) => (
        <span key={item.tone} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded border ${TONE_CLASSES[item.tone]}`} />
          {item.label}
        </span>
      ))}
      <span>所定 7:30〜17:30（猶予5分）</span>
    </div>
  );
}
