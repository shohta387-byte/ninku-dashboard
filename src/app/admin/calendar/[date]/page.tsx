import Link from "next/link";
import { getAllEntriesForDay } from "@/app/actions";
import {
  BREAK_WINDOWS,
  calculateNinkuForEntry,
  getWorkedBreakKeysFromEntry,
  type BreakKey,
} from "@/lib/ninku";
import { formatJstDate, formatJstTime, jstMidnightFromInputValue, toJstParts } from "@/lib/jst-date";
import { DeleteEntryButton } from "@/app/entries/delete-entry-button";
import { siteLabel } from "@/lib/site-label";

export default async function AdminCalendarDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const workDate = jstMidnightFromInputValue(date);
  const { year, month } = toJstParts(workDate);

  const entries = await getAllEntriesForDay(date);

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Link href={`/admin/calendar?year=${year}&month=${month}`} className="text-sm text-blue-600 underline">
        ← カレンダーに戻る
      </Link>
      <h2 className="text-lg font-bold">
        {formatJstDate(workDate, { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}
      </h2>

      {entries.length === 0 && <p className="text-zinc-500">この日の打刻はありません。</p>}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <DayEntryCard key={entry.id} entry={entry} employeeName={entry.employee.name} siteName={siteLabel(entry.site)} />
        ))}
      </div>
    </div>
  );
}

function DayEntryCard({
  entry,
  employeeName,
  siteName,
}: {
  entry: {
    id: string;
    clockIn: Date | null;
    clockOut: Date | null;
    workedBreak1: boolean;
    workedBreak2: boolean;
    workedBreak3: boolean;
  };
  employeeName: string;
  siteName: string;
}) {
  const isComplete = entry.clockIn && entry.clockOut;
  const workedBreakKeys = isComplete ? getWorkedBreakKeysFromEntry(entry) : [];
  const result = isComplete
    ? calculateNinkuForEntry(entry.clockIn!, entry.clockOut!, workedBreakKeys)
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <p className="font-bold">{employeeName}</p>
        <p className="text-sm text-zinc-500">{siteName}</p>
      </div>
      <p>
        出勤: {entry.clockIn ? formatJstTime(entry.clockIn, { hour: "2-digit", minute: "2-digit" }) : "—"}
        {" 〜 "}
        退勤: {entry.clockOut ? formatJstTime(entry.clockOut, { hour: "2-digit", minute: "2-digit" }) : "未退勤"}
      </p>
      {!entry.clockOut && (
        <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
          ⚠ 退勤の打刻がありません
        </p>
      )}
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
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-4">
          <Link href={`/admin/entries/${entry.id}`} className="text-blue-600 underline">
            詳細
          </Link>
          <Link href={`/entries/${entry.id}/edit`} className="text-blue-600 underline">
            時刻を修正する
          </Link>
        </div>
        <DeleteEntryButton entryId={entry.id} />
      </div>
    </div>
  );
}

function breakLabel(key: BreakKey): string {
  return BREAK_WINDOWS.find((w) => w.key === key)!.label;
}
