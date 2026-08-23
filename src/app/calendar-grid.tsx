import Link from "next/link";
import { buildCalendarWeeks, WEEKDAY_LABELS_JA, type CalendarDay } from "@/lib/calendar";
import { shiftJstMonth, toJstInputValue } from "@/lib/jst-date";

// 従業員用(/entries/calendar)・管理者用(/admin/calendar)の両方で使う、月カレンダーの
// グリッド表示。日付をタップするとその日の詳細（baseHref配下の日付ページ）へ飛べる。
// 未来の月は意味が無いため、次の月への遷移は今月までに制限する（canGoNextで制御）。
export function CalendarGrid({
  year,
  month,
  today,
  countByDay,
  baseHref,
  canGoNext,
}: {
  year: number;
  month: number;
  today: Date;
  countByDay: Map<number, number>;
  baseHref: string;
  canGoNext: boolean;
}) {
  const weeks = buildCalendarWeeks(year, month, today);
  const prev = shiftJstMonth(year, month, -1);
  const next = shiftJstMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`${baseHref}?year=${prev.year}&month=${prev.month}`}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm font-bold active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
        >
          ← 前の月
        </Link>
        <p className="text-lg font-bold">
          {year}年{month}月
        </p>
        {canGoNext ? (
          <Link
            href={`${baseHref}?year=${next.year}&month=${next.month}`}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-bold active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
          >
            次の月 →
          </Link>
        ) : (
          <span className="rounded-lg border border-black/5 px-3 py-2 text-sm font-bold text-zinc-300 dark:border-white/5 dark:text-zinc-700">
            次の月 →
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
        {WEEKDAY_LABELS_JA.map((label, i) => (
          <div
            key={label}
            className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500"}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell) => (
          <DayCell key={cell.date.getTime()} cell={cell} count={countByDay.get(cell.date.getTime()) ?? 0} baseHref={baseHref} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ cell, count, baseHref }: { cell: CalendarDay; count: number; baseHref: string }) {
  if (!cell.inMonth) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg text-xs text-zinc-300 dark:text-zinc-700">
        {cell.day}
      </div>
    );
  }

  const dateStr = toJstInputValue(cell.date);
  const weekdayColor = cell.dayOfWeek === 0 ? "text-red-500" : cell.dayOfWeek === 6 ? "text-blue-500" : "";
  const hasEntries = count > 0;

  return (
    <Link
      href={`${baseHref}/${dateStr}`}
      className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-1 text-xs active:bg-zinc-100 dark:active:bg-zinc-800 ${
        cell.isToday ? "border-2 border-blue-600" : "border-black/10 dark:border-white/10"
      } ${hasEntries ? "bg-blue-50 dark:bg-blue-950" : "bg-white dark:bg-zinc-900"}`}
    >
      <span className={`font-bold ${weekdayColor}`}>{cell.day}</span>
      {hasEntries && (
        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {count}件
        </span>
      )}
    </Link>
  );
}
