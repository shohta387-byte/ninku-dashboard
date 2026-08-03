import Link from "next/link";
import { redirect } from "next/navigation";
import {
  clockIn,
  clockOut,
  getCurrentEmployee,
  getSiteById,
  getTodayEntriesForSelf,
} from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import {
  BREAK_WINDOWS,
  calculateNinkuForEntry,
  getBreakWindowsWithinSpan,
  getWorkedBreakKeysFromEntry,
  type BreakKey,
} from "@/lib/ninku";

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
  const clockInAction = clockIn.bind(null, siteId);

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

      {!openEntry && (
        <form action={clockInAction}>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-5 py-6 text-xl font-bold text-white shadow-sm active:bg-blue-700"
          >
            作業開始（入場）
          </button>
        </form>
      )}

      {openEntry && (
        <div className="flex flex-col gap-4">
          <p className="text-lg">出勤: {formatTime(openEntry.clockIn!)}</p>
          <form action={clockOut.bind(null, openEntry.id)} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <legend className="px-1 text-sm text-zinc-500">
                休憩が取れなかった時間帯があればチェック（稼働として人工に加算されます）
              </legend>
              {eligibleBreaks.map((w) => (
                <label key={w.key} className="flex items-center gap-3 text-lg">
                  <input type="checkbox" name={w.key} className="h-6 w-6" />
                  {w.label} は休憩なしで稼働した
                </label>
              ))}
              {eligibleBreaks.length === 0 && (
                <p className="text-sm text-zinc-500">
                  現在の勤務時間には定時休憩が含まれていません。
                </p>
              )}
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500">日報（任意）</span>
              <textarea
                name="dailyReport"
                rows={3}
                placeholder="本日の作業内容など"
                className="rounded-lg border border-black/20 px-4 py-3 dark:border-white/20 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-orange-600 px-5 py-6 text-xl font-bold text-white shadow-sm active:bg-orange-700"
            >
              作業終了（退場）
            </button>
          </form>
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
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function breakLabel(key: BreakKey): string {
  return BREAK_WINDOWS.find((w) => w.key === key)!.label;
}
