import Link from "next/link";
import { getCurrentEmployee, getMyEntriesForCurrentPeriod } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import {
  BREAK_WINDOWS,
  calculateNinkuForEntry,
  getWorkedBreakKeysFromEntry,
  type BreakKey,
} from "@/lib/ninku";
import { currentBillingPeriod, formatJstDate, formatJstTime, toJstInputValue } from "@/lib/jst-date";
import { DeleteEntryButton } from "./delete-entry-button";

export default async function EntriesListPage() {
  const { isAdmin } = await requireEmployeeSession();
  const [employee, entries] = await Promise.all([
    getCurrentEmployee(),
    getMyEntriesForCurrentPeriod(),
  ]);
  const { from, to } = currentBillingPeriod();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">打刻一覧</h1>
        <p className="text-sm text-zinc-500">
          今の締め期間: {toJstInputValue(from)} 〜 {toJstInputValue(to)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} siteName={entry.site.name} />
        ))}
        {entries.length === 0 && (
          <p className="text-zinc-500">この期間の打刻はまだありません。</p>
        )}
      </div>

      <Link href="/entries/manual" className="text-center text-sm text-blue-600 underline">
        打刻を後から手動で追加する
      </Link>
    </main>
  );
}

function EntryCard({
  entry,
  siteName,
}: {
  entry: {
    id: string;
    workDate: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    workedBreak1: boolean;
    workedBreak2: boolean;
    workedBreak3: boolean;
  };
  siteName: string;
}) {
  const isOpen = entry.clockIn && !entry.clockOut;
  const isComplete = entry.clockIn && entry.clockOut;
  const workedBreakKeys = isComplete ? getWorkedBreakKeysFromEntry(entry) : [];
  const result = isComplete
    ? calculateNinkuForEntry(entry.clockIn!, entry.clockOut!, workedBreakKeys)
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <p className="font-bold">{siteName}</p>
        <p className="text-sm text-zinc-500">{formatJstDate(entry.workDate, { month: "2-digit", day: "2-digit", weekday: "short" })}</p>
      </div>
      <p>
        出勤: {entry.clockIn ? formatJstTime(entry.clockIn, { hour: "2-digit", minute: "2-digit" }) : "—"}
        {" 〜 "}
        退勤: {entry.clockOut ? formatJstTime(entry.clockOut, { hour: "2-digit", minute: "2-digit" }) : "未退勤"}
      </p>
      {isOpen && (
        <p className="text-sm text-orange-600 dark:text-orange-400">
          退勤の打刻がありません。時刻を修正して退勤時刻を入力してください。
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
        <Link href={`/entries/${entry.id}/edit`} className="text-blue-600 underline">
          時刻を修正する
        </Link>
        <DeleteEntryButton entryId={entry.id} />
      </div>
    </div>
  );
}

function breakLabel(key: BreakKey): string {
  return BREAK_WINDOWS.find((w) => w.key === key)!.label;
}
