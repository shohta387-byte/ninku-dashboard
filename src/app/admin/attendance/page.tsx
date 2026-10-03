import Link from "next/link";
import { getEmployeesForAttendance, getEntriesForEmployeeInRange } from "@/app/actions";
import { AttendanceCalendar, type AttendanceCell } from "@/app/attendance-calendar";
import {
  groupByWorkDate,
  judgeDay,
  subcontractorDayUnits,
  summarizeAttendance,
  type DayAttendance,
} from "@/lib/attendance";
import { buildCalendarWeeksForRange } from "@/lib/calendar";
import {
  currentBillingPeriod,
  formatJstDate,
  formatJstTime,
  jstMidnightFromInputValue,
  todayInJst,
  toJstInputValue,
} from "@/lib/jst-date";
import { calculateNinkuForEntry, getWorkedBreakKeysFromEntry, roundNinku } from "@/lib/ninku";

const DAY_MS = 24 * 60 * 60 * 1000;

function hhmm(date: Date | null): string {
  return date ? formatJstTime(date, { hour: "2-digit", minute: "2-digit" }) : "—";
}

function shortDate(date: Date): string {
  return formatJstDate(date, { month: "numeric", day: "numeric", weekday: "short" });
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; period?: string }>;
}) {
  const params = await searchParams;
  const today = todayInJst();
  const employees = await getEmployeesForAttendance();
  const employee = employees.find((e) => e.id === params.employeeId) ?? null;

  // 労務士さんとの照合に合わせ、締め期間（21日〜翌月20日）単位で表示する。
  // periodはその締め期間に含まれる任意の日付（"YYYY-MM-DD"）。
  const reference = params.period ? jstMidnightFromInputValue(params.period) : today;
  const { from, to } = currentBillingPeriod(reference);
  const prev = currentBillingPeriod(new Date(from.getTime() - DAY_MS));
  const next = currentBillingPeriod(new Date(to.getTime() + DAY_MS));
  const canGoNext = next.from <= today;

  const hrefFor = (period: Date) =>
    `/admin/attendance?employeeId=${employee?.id ?? ""}&period=${toJstInputValue(period)}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">従業員別勤怠</h2>
        <p className="text-sm text-zinc-500">
          1人ずつ、締め期間（21日〜20日）の出勤・遅刻・早退・退勤忘れをカレンダーで確認できます。
        </p>
      </div>

      <form method="get" action="/admin/attendance" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">従業員</span>
          <select
            name="employeeId"
            defaultValue={employee?.id ?? ""}
            required
            className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
          >
            <option value="" disabled>
              選択してください
            </option>
            <optgroup label="従業員">
              {employees
                .filter((e) => !e.isSubcontractor)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.isActive ? "" : "（無効）"}
                  </option>
                ))}
            </optgroup>
            <optgroup label="外注">
              {employees
                .filter((e) => e.isSubcontractor)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.isActive ? "" : "（無効）"}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <input type="hidden" name="period" value={toJstInputValue(from)} />
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white active:bg-blue-700">
          表示
        </button>
      </form>

      {employee ? (
        <EmployeeAttendance
          employeeId={employee.id}
          isSubcontractor={employee.isSubcontractor}
          from={from}
          to={to}
          today={today}
          prevHref={hrefFor(prev.from)}
          nextHref={canGoNext ? hrefFor(next.from) : null}
        />
      ) : (
        <p className="text-zinc-500">従業員を選んで「表示」を押してください。</p>
      )}
    </div>
  );
}

async function EmployeeAttendance({
  employeeId,
  isSubcontractor,
  from,
  to,
  today,
  prevHref,
  nextHref,
}: {
  employeeId: string;
  isSubcontractor: boolean;
  from: Date;
  to: Date;
  today: Date;
  prevHref: string;
  nextHref: string | null;
}) {
  const entries = await getEntriesForEmployeeInRange(employeeId, from, to);
  const byDay = groupByWorkDate(entries);

  const cells = new Map<number, AttendanceCell>();
  const days: { date: Date; attendance: DayAttendance; units: number; sites: string[] }[] = [];
  for (const [key, dayEntries] of byDay) {
    const date = new Date(key);
    const attendance = judgeDay(dayEntries, key === today.getTime());
    const units = subcontractorDayUnits(dayEntries);
    const hasOpenEntry = dayEntries.some((e) => e.clockIn && !e.clockOut);
    cells.set(
      key,
      isSubcontractor ? { kind: "subcontractor", units, hasOpenEntry } : { kind: "employee", day: attendance },
    );
    days.push({ date, attendance, units, sites: [...new Set(dayEntries.map((e) => e.site.name))] });
  }
  days.sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalNinku = roundNinku(
    entries.reduce((sum, e) => {
      if (!e.clockIn || !e.clockOut) return sum;
      return sum + calculateNinkuForEntry(e.clockIn, e.clockOut, getWorkedBreakKeysFromEntry(e)).totalNinku;
    }, 0),
  );
  const summary = summarizeAttendance(days.map((d) => d.attendance));
  const totalUnits = days.reduce((sum, d) => sum + d.units, 0);

  const title = `${formatJstDate(from, { year: "numeric", month: "numeric", day: "numeric" })}〜${formatJstDate(to, {
    month: "numeric",
    day: "numeric",
  })}`;

  const stats = isSubcontractor
    ? [
        { label: "稼働日数（半日単位）", value: `${totalUnits}日` },
        { label: "退勤なし（要確認）", value: `${summary.missingClockOutCount}件`, alert: summary.missingClockOutCount > 0 },
        { label: "人工合計", value: `${totalNinku}` },
      ]
    : [
        { label: "出勤日数", value: `${summary.workedDays}日` },
        { label: "遅刻", value: `${summary.lateCount}回`, alert: summary.lateCount > 0 },
        { label: "早退", value: `${summary.earlyLeaveCount}回`, alert: summary.earlyLeaveCount > 0 },
        { label: "退勤なし（要確認）", value: `${summary.missingClockOutCount}件`, alert: summary.missingClockOutCount > 0 },
        { label: "人工合計", value: `${totalNinku}` },
      ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`text-lg font-bold ${s.alert ? "text-red-600 dark:text-red-400" : ""}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <AttendanceCalendar
          title={title}
          weeks={buildCalendarWeeksForRange(from, to, today)}
          cells={cells}
          dayHref={(dateStr) => `/admin/calendar/${dateStr}`}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">日付</th>
              <th className="px-3 py-2">出勤</th>
              <th className="px-3 py-2">退勤</th>
              <th className="px-3 py-2">{isSubcontractor ? "稼働" : "状態"}</th>
              <th className="px-3 py-2">現場</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date.getTime()} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/admin/calendar/${toJstInputValue(d.date)}`} className="text-blue-600 underline">
                    {shortDate(d.date)}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{hhmm(d.attendance.firstClockIn)}</td>
                <td className="px-3 py-2 tabular-nums">{hhmm(d.attendance.lastClockOut)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {isSubcontractor ? `${d.units}日` : <StatusText day={d.attendance} />}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">{d.sites.join("、")}</td>
              </tr>
            ))}
            {days.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-zinc-500">
                  この期間の打刻はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusText({ day }: { day: DayAttendance }) {
  if (day.status === "missingClockOut") {
    return <span className="font-bold text-red-600 dark:text-red-400">退勤なし</span>;
  }
  if (day.status === "working") return <span className="text-green-700 dark:text-green-400">勤務中</span>;
  const parts = [
    day.lateMinutes > 0 && `遅刻 ${day.lateMinutes}分`,
    day.earlyLeaveMinutes > 0 && `早退 ${day.earlyLeaveMinutes}分`,
  ].filter(Boolean);
  if (parts.length === 0) return <span>出勤</span>;
  return <span className="font-bold text-yellow-700 dark:text-yellow-400">{parts.join("・")}</span>;
}
