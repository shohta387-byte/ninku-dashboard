import Link from "next/link";
import { getCurrentEmployee, getMyEntriesForDay } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import {
  BREAK_WINDOWS,
  calculateNinkuForEntry,
  getWorkedBreakKeysFromEntry,
  type BreakKey,
} from "@/lib/ninku";
import { currentBillingPeriod, formatJstDate, formatJstTime, jstMidnightFromInputValue, toJstParts } from "@/lib/jst-date";
import { DeleteEntryButton } from "../../delete-entry-button";

export default async function EntriesCalendarDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { isAdmin } = await requireEmployeeSession();
  const { date } = await params;
  const workDate = jstMidnightFromInputValue(date);
  const { year, month } = toJstParts(workDate);

  const [employee, entries] = await Promise.all([getCurrentEmployee(), getMyEntriesForDay(date)]);
  const { from, to } = currentBillingPeriod();
  const isEditable = isAdmin || (workDate >= from && workDate <= to);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href={`/entries/calendar?year=${year}&month=${month}`} className="text-sm text-blue-600 underline">
        ← カレンダーに戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          {formatJstDate(workDate, { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}
        </h1>
      </div>

      {entries.length === 0 && <p className="text-zinc-500">この日の打刻はありません。</p>}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <DayEntryCard key={entry.id} entry={entry} siteName={entry.site.name} isEditable={isEditable} />
        ))}
      </div>

      {!isEditable && entries.length > 0 && (
        <p className="text-xs text-zinc-400">
          今の締め期間（21日〜20日）より前の打刻は、修正・削除できません。
        </p>
      )}
    </main>
  );
}

function DayEntryCard({
  entry,
  siteName,
  isEditable,
}: {
  entry: {
    id: string;
    clockIn: Date | null;
    clockOut: Date | null;
    workedBreak1: boolean;
    workedBreak2: boolean;
    workedBreak3: boolean;
  };
  siteName: string;
  isEditable: boolean;
}) {
  const isComplete = entry.clockIn && entry.clockOut;
  const workedBreakKeys = isComplete ? getWorkedBreakKeysFromEntry(entry) : [];
  const result = isComplete
    ? calculateNinkuForEntry(entry.clockIn!, entry.clockOut!, workedBreakKeys)
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className="font-bold">{siteName}</p>
      <p>
        出勤: {entry.clockIn ? formatJstTime(entry.clockIn, { hour: "2-digit", minute: "2-digit" }) : "—"}
        {" 〜 "}
        退勤: {entry.clockOut ? formatJstTime(entry.clockOut, { hour: "2-digit", minute: "2-digit" }) : "未退勤"}
      </p>
      {result && (
        <>
          <p>
            稼働時間: {result.workedHours}h（うち時間外 {result.overtimeHours}h）
          </p>
          <p className="text-lg font-bold">人工: {result.totalNinku}</p>
          {workedBreakKeys.length > 0 && (
            <p className="text-sm text-zinc-500">
              休憩なしで稼働: {workedBreakKeys.map((k) => breakLabel(k)).join("、")}
            </p>
          )}
        </>
      )}
      {isEditable && (
        <div className="flex items-center justify-between pt-2">
          <Link href={`/entries/${entry.id}/edit`} className="text-blue-600 underline">
            時刻を修正する
          </Link>
          <DeleteEntryButton entryId={entry.id} />
        </div>
      )}
    </div>
  );
}

function breakLabel(key: BreakKey): string {
  return BREAK_WINDOWS.find((w) => w.key === key)!.label;
}
