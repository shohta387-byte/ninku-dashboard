import Link from "next/link";
import { getReportEntries, getSitesForAdmin } from "@/app/actions";
import {
  summarizeByEmployee,
  summarizeByPeriod,
  sumHours,
  sumNinku,
  type ReportGranularity,
} from "@/lib/report";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function firstDayOfThisMonth(): string {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function today(): string {
  return toDateInputValue(new Date());
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" });
}

const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  day: "日ごと",
  week: "週ごと",
  month: "月ごと",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; from?: string; to?: string; groupBy?: string }>;
}) {
  const params = await searchParams;
  const siteId = params.siteId || "";
  const from = params.from || firstDayOfThisMonth();
  const to = params.to || today();
  const groupBy: ReportGranularity =
    params.groupBy === "week" || params.groupBy === "month" ? params.groupBy : "day";

  const [sites, entries] = await Promise.all([
    getSitesForAdmin(),
    getReportEntries({ siteId: siteId || undefined, from, to }),
  ]);

  const periodSummaries = summarizeByPeriod(entries, groupBy);
  const employeeSummaries = summarizeByEmployee(entries);
  const totalNinku = sumNinku(entries);
  const totalHours = sumHours(entries);
  const selectedSiteName = siteId ? (sites.find((s) => s.id === siteId)?.name ?? "") : "全現場";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">検索条件</h2>
        <form className="flex flex-wrap items-end gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">現場</span>
            <select
              name="siteId"
              defaultValue={siteId}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
            >
              <option value="">全現場</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">開始日</span>
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">終了日</span>
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">集計単位</span>
            <select
              name="groupBy"
              defaultValue={groupBy}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
            >
              <option value="day">日ごと</option>
              <option value="week">週ごと</option>
              <option value="month">月ごと</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-sm active:bg-blue-700"
          >
            検索
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">
          {selectedSiteName} / {from} 〜 {to}
        </p>
        <p className="text-3xl font-bold">合計人工: {totalNinku}</p>
        <p className="text-sm text-zinc-500">
          稼働時間合計: {totalHours}h（{entries.length}件の打刻）
        </p>
        <div className="flex gap-4 pt-2 text-sm">
          <a
            href={`/api/admin/reports/export?${new URLSearchParams({ siteId, from, to, type: "detail" })}`}
            className="text-blue-600 underline"
          >
            打刻詳細をCSVでダウンロード
          </a>
          <a
            href={`/api/admin/reports/export?${new URLSearchParams({ siteId, from, to, type: "employee" })}`}
            className="text-blue-600 underline"
          >
            従業員別人工をCSVでダウンロード
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{GRANULARITY_LABELS[groupBy]}の人工推移</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">期間</th>
                <th className="px-4 py-2">人工</th>
                <th className="px-4 py-2">稼働時間</th>
                <th className="px-4 py-2">打刻件数</th>
              </tr>
            </thead>
            <tbody>
              {periodSummaries.map((p) => (
                <tr key={p.key} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{p.label}</td>
                  <td className="px-4 py-2 font-bold">{p.totalNinku}</td>
                  <td className="px-4 py-2">{p.totalHours}h</td>
                  <td className="px-4 py-2">{p.entryCount}</td>
                </tr>
              ))}
              {periodSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-zinc-500">
                    この条件に一致する打刻はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">従業員ごとの人工（期間合計）</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">従業員</th>
                <th className="px-4 py-2">人工</th>
                <th className="px-4 py-2">稼働時間</th>
                <th className="px-4 py-2">打刻件数</th>
              </tr>
            </thead>
            <tbody>
              {employeeSummaries.map((e) => (
                <tr key={e.employeeId} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{e.employeeName}</td>
                  <td className="px-4 py-2 font-bold">{e.totalNinku}</td>
                  <td className="px-4 py-2">{e.totalHours}h</td>
                  <td className="px-4 py-2">{e.entryCount}</td>
                </tr>
              ))}
              {employeeSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-zinc-500">
                    この条件に一致する打刻はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">打刻の詳細一覧</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">日付</th>
                <th className="px-4 py-2">従業員</th>
                <th className="px-4 py-2">現場</th>
                <th className="px-4 py-2">出勤〜退勤</th>
                <th className="px-4 py-2">稼働時間</th>
                <th className="px-4 py-2">人工</th>
                <th className="px-4 py-2">日報</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{formatDate(e.workDate)}</td>
                  <td className="px-4 py-2">{e.employeeName}</td>
                  <td className="px-4 py-2">{e.siteName}</td>
                  <td className="px-4 py-2">
                    {formatTime(e.clockIn)} 〜 {formatTime(e.clockOut)}
                  </td>
                  <td className="px-4 py-2">{e.ninku.workedHours}h</td>
                  <td className="px-4 py-2 font-bold">{e.ninku.totalNinku}</td>
                  <td className="px-4 py-2">{e.dailyReport ? "あり" : ""}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/entries/${e.id}`} className="text-blue-600 underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-zinc-500">
                    この条件に一致する打刻はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
