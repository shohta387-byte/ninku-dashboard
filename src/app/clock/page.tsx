import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee, getSiteById, getTodayEntriesForSelf } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import {
  BREAK_WINDOWS,
  calculateNinkuForEntry,
  getBreakWindowsWithinSpan,
  getWorkedBreakKeysFromEntry,
  type BreakKey,
} from "@/lib/ninku";
import { formatJstTime } from "@/lib/jst-date";
import { ClockInButton } from "./clock-in-button";
import { ClockOutForm } from "./clock-out-form";

export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) {
    redirect("/sites");
  }

  const { isAdmin } = await requireEmployeeSession();
  const [employee, selectedSite, entries] = await Promise.all([
    getCurrentEmployee(),
    getSiteById(siteId),
    getTodayEntriesForSelf(),
  ]);
  if (!selectedSite) {
    redirect("/sites");
  }

  const openEntry = entries.find((e) => !e.clockOut) ?? null;
  const completedEntries = entries.filter((e) => e.clockOut);

  // 実際の勤務時間（出勤〜現在時刻）に含まれる休憩枠しかチェックできないようにする。
  const eligibleBreaks = openEntry?.clockIn
    ? getBreakWindowsWithinSpan(openEntry.workDate, openEntry.clockIn, new Date())
    : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/sites" className="text-sm text-blue-600 underline">
        ← 現場選択に戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          本日の現場: {openEntry ? openEntry.site.name : selectedSite.name}
        </h1>
      </div>

      {!openEntry && <ClockInButton siteId={siteId} />}

      {openEntry && (
        <div className="flex flex-col gap-4">
          <p className="text-lg">出勤: {formatTime(openEntry.clockIn!)}</p>
          <ClockOutForm entryId={openEntry.id} eligibleBreaks={eligibleBreaks} />
        </div>
      )}

      {completedEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-zinc-500">本日の記録</h2>
          {completedEntries.map((entry) => (
            <EntrySummary key={entry.id} entry={entry} siteName={entry.site.name} />
          ))}
        </div>
      )}

      <Link href="/entries/manual" className="text-center text-sm text-blue-600 underline">
        打刻を後から手動で追加する
      </Link>
    </main>
  );
}

function EntrySummary({
  entry,
  siteName,
}: {
  entry: {
    id: string;
    clockIn: Date | null;
    clockOut: Date | null;
    workedBreak1: boolean;
    workedBreak2: boolean;
    workedBreak3: boolean;
    dailyReport: string | null;
  };
  siteName: string;
}) {
  if (!entry.clockIn || !entry.clockOut) return null;
  const workedBreakKeys = getWorkedBreakKeysFromEntry(entry);
  const result = calculateNinkuForEntry(entry.clockIn, entry.clockOut, workedBreakKeys);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className="font-bold">{siteName}</p>
      <p>
        出勤: {formatTime(entry.clockIn)} 〜 退勤: {formatTime(entry.clockOut)}
      </p>
      <p>
        稼働時間: {result.workedHours}h（うち時間外 {result.overtimeHours}h）
      </p>
      <p className="text-lg font-bold">人工: {result.totalNinku}</p>
      {workedBreakKeys.length > 0 && (
        <p className="text-sm text-zinc-500">
          休憩なしで稼働: {workedBreakKeys.map((k) => breakLabel(k)).join("、")}
        </p>
      )}
      {entry.dailyReport && (
        <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          日報: {entry.dailyReport}
        </p>
      )}
      <Link href={`/entries/${entry.id}/edit`} className="text-blue-600 underline">
        時刻を修正する
      </Link>
    </div>
  );
}

function formatTime(date: Date): string {
  return formatJstTime(date, { hour: "2-digit", minute: "2-digit" });
}

function breakLabel(key: BreakKey): string {
  return BREAK_WINDOWS.find((w) => w.key === key)!.label;
}
