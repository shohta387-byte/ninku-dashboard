import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractorDetail } from "@/app/actions";
import { toJstInputValue } from "@/lib/jst-date";

function formatDate(date: Date | null): string {
  return date ? toJstInputValue(date) : "—";
}

type ContractorDetail = NonNullable<Awaited<ReturnType<typeof getContractorDetail>>>;
type Row = ContractorDetail["siteSummaries"][number];

// 元請けを選んで、その元請けの現場と人工を一覧する画面。現場名から現場の詳細へ進める。
export default async function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractorDetail(id);
  if (!detail) notFound();

  const { name, isActive, period, siteSummaries } = detail;
  const activeSites = siteSummaries.filter((s) => s.site.isActive);
  const inactiveSites = siteSummaries.filter((s) => !s.site.isActive);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/contractors" className="text-sm text-blue-600 underline">
        ← 元請け一覧に戻る
      </Link>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-bold">{name}</h2>
        {!isActive && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">無効</span>}
        <span className="text-sm text-zinc-500">{siteSummaries.length}現場</span>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-2">
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-zinc-500">
            今の締め期間の人工（{formatDate(period.from)}〜{formatDate(period.to)}）
          </p>
          <p className="text-2xl font-bold tabular-nums">{detail.periodNinku}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-zinc-500">累計の人工</p>
          <p className="text-2xl font-bold tabular-nums">{detail.totalNinku}</p>
        </div>
      </div>

      <SiteTable title="稼働中の現場" rows={activeSites} />
      {inactiveSites.length > 0 && <SiteTable title="過去の現場（無効化済み）" rows={inactiveSites} />}
    </div>
  );
}

function SiteTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-zinc-500">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">現場名</th>
              <th className="px-4 py-2">今の締め期間の人工</th>
              <th className="px-4 py-2">今の締め期間の人数</th>
              <th className="px-4 py-2">累計の人工</th>
              <th className="px-4 py-2">最終稼働日</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ site, periodNinku, periodPeople, totalNinku, lastWorkDate }) => (
              <tr key={site.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2">
                  <Link href={`/admin/sites/${site.id}`} className="font-bold text-blue-600 underline">
                    {site.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-bold tabular-nums">{periodNinku}</td>
                <td className="px-4 py-2 tabular-nums">{periodPeople}人</td>
                <td className="px-4 py-2 tabular-nums">{totalNinku}</td>
                <td className="px-4 py-2 tabular-nums">{formatDate(lastWorkDate)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-zinc-500">
                  該当する現場はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
