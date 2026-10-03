import Link from "next/link";
import { getCurrentEmployee, getMyEntriesForMonth } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { jstMonthRange, shiftJstMonth, todayInJst, toJstParts } from "@/lib/jst-date";
import { AttendanceCalendar, type AttendanceCell } from "@/app/attendance-calendar";
import { groupByWorkDate, judgeDay, summarizeAttendance, type DayAttendance } from "@/lib/attendance";
import { buildCalendarWeeksForRange } from "@/lib/calendar";
import { calculateNinkuForEntry, getWorkedBreakKeysFromEntry, roundNinku } from "@/lib/ninku";
import { EntriesViewTabs } from "../entries-view-tabs";

export default async function EntriesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { isAdmin } = await requireEmployeeSession();
  const params = await searchParams;
  const today = todayInJst();
  const todayParts = toJstParts(today);

  const year = Number(params.year) || todayParts.year;
  const month = Number(params.month) || todayParts.month;

  const [employee, entries] = await Promise.all([
    getCurrentEmployee(),
    getMyEntriesForMonth(year, month),
  ]);

  const cells = new Map<number, AttendanceCell>();
  const days: DayAttendance[] = [];
  for (const [key, dayEntries] of groupByWorkDate(entries)) {
    const day = judgeDay(dayEntries, key === today.getTime());
    cells.set(key, { kind: "employee", day });
    days.push(day);
  }
  const summary = summarizeAttendance(days);
  const totalNinku = roundNinku(
    entries.reduce((sum, e) => {
      if (!e.clockIn || !e.clockOut) return sum;
      return sum + calculateNinkuForEntry(e.clockIn, e.clockOut, getWorkedBreakKeysFromEntry(e)).totalNinku;
    }, 0),
  );

  const canGoNext = year * 12 + month < todayParts.year * 12 + todayParts.month;
  const prev = shiftJstMonth(year, month, -1);
  const next = shiftJstMonth(year, month, 1);
  const { from, to } = jstMonthRange(year, month);
  const stats = [
    { label: "出勤日数", value: `${summary.workedDays}日` },
    { label: "人工合計", value: `${totalNinku}` },
    { label: "遅刻", value: `${summary.lateCount}回`, alert: summary.lateCount > 0 },
    { label: "早退", value: `${summary.earlyLeaveCount}回`, alert: summary.earlyLeaveCount > 0 },
    { label: "退勤なし", value: `${summary.missingClockOutCount}件`, alert: summary.missingClockOutCount > 0 },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">打刻一覧</h1>
        <p className="text-sm text-zinc-500">
          日付をタップすると、その日の打刻の詳細・修正・削除ができます。
        </p>
      </div>

      <EntriesViewTabs active="calendar" />

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-black/10 p-2 dark:border-white/10">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={`font-bold ${s.alert ? "text-red-600 dark:text-red-400" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <AttendanceCalendar
        title={`${year}年${month}月`}
        weeks={buildCalendarWeeksForRange(from, to, today)}
        cells={cells}
        dayHref={(dateStr) => `/entries/calendar/${dateStr}`}
        prevHref={`/entries/calendar?year=${prev.year}&month=${prev.month}`}
        nextHref={canGoNext ? `/entries/calendar?year=${next.year}&month=${next.month}` : null}
      />

      <Link href="/entries/manual" className="text-center text-sm text-blue-600 underline">
        打刻を後から手動で追加する
      </Link>
    </main>
  );
}
