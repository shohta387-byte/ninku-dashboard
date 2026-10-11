import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteDetail } from "@/app/actions";
import { formatJstDate, formatJstTime, toJstInputValue } from "@/lib/jst-date";
import { calculateNinkuForEntry, getWorkedBreakKeysFromEntry } from "@/lib/ninku";

function hhmm(date: Date | null): string {
  return date ? formatJstTime(date, { hour: "2-digit", minute: "2-digit" }) : "—";
}

function periodLabel(p: { from: Date; to: Date }): string {
  return `${toJstInputValue(p.from)}〜${toJstInputValue(p.to)}`;
}

// 現場の詳細：締め期間ごと・累計の人工、今の締め期間の従業員別人工、直近の打刻。
// ここから、その現場の打刻の代理入力やレポートへ進める。
export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getSiteDetail(id);
  if (!detail) notFound();

  const { site, period, lastPeriod } = detail;
  const contractorName = site.contractor ? site.contractor.name : "元請け未設定";
  const stats = [
    { label: `今の締め期間（${periodLabel(period)}）`, value: detail.periodNinku },
    { label: `前の締め期間（${periodLabel(lastPeriod)}）`, value: detail.lastPeriodNinku },
    { label: `累計（稼働${detail.totalDays}日）`, value: detail.totalNinku },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/contractors/${site.contractorId ?? "unassigned"}`} className="text-sm text-blue-600 underline">
        ← {contractorName}の現場一覧に戻る
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">{contractorName}</p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold">{site.name}</h2>
          {!site.isActive && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">無効</span>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums">
              {s.value}
              <span className="ml-1 text-sm font-normal text-zinc-500">人工</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/entries/new?siteId=${site.id}`}
          className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white shadow-sm active:bg-blue-700"
        >
          この現場の打刻を代理入力する
        </Link>
        <Link
          href={`/admin/reports?${new URLSearchParams({ siteId: site.id, from: toJstInputValue(period.from), to: toJstInputValue(period.to) })}`}
          className="rounded-lg border border-black/10 px-4 py-2 font-bold active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
        >
          レポートで詳しく見る・CSV
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">今の締め期間の従業員別人工</h3>
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
              {detail.employeeSummaries.map((e) => (
                <tr key={e.employeeId} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{e.employeeName}</td>
                  <td className="px-4 py-2 font-bold tabular-nums">{e.totalNinku}</td>
                  <td className="px-4 py-2 tabular-nums">{e.totalHours}h</td>
                  <td className="px-4 py-2 tabular-nums">{e.entryCount}</td>
                </tr>
              ))}
              {detail.employeeSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-zinc-500">
                    今の締め期間の打刻はまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">直近の打刻（新しい順・最大30件）</h3>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">日付</th>
                <th className="px-4 py-2">従業員</th>
                <th className="px-4 py-2">出勤</th>
                <th className="px-4 py-2">退勤</th>
                <th className="px-4 py-2">人工</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {detail.recentEntries.map((e) => {
                const ninku =
                  e.clockIn && e.clockOut
                    ? calculateNinkuForEntry(e.clockIn, e.clockOut, getWorkedBreakKeysFromEntry(e)).totalNinku
                    : null;
                return (
                  <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/admin/calendar/${toJstInputValue(e.workDate)}`} className="text-blue-600 underline">
                        {formatJstDate(e.workDate, { month: "numeric", day: "numeric", weekday: "short" })}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{e.employee.name}</td>
                    <td className="px-4 py-2 tabular-nums">{hhmm(e.clockIn)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {e.clockOut ? (
                        hhmm(e.clockOut)
                      ) : (
                        <span className="font-bold text-red-600 dark:text-red-400">未退勤</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-bold tabular-nums">{ninku ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/entries/${e.id}/edit`} className="text-blue-600 underline">
                        修正
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {detail.recentEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-zinc-500">
                    この現場の打刻はまだありません。
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
