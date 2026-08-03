import Link from "next/link";
import { getSiteLifetimeSummaries, setSiteActive } from "@/app/actions";
import { toJstInputValue } from "@/lib/jst-date";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return toJstInputValue(date);
}

type SiteSummary = Awaited<ReturnType<typeof getSiteLifetimeSummaries>>[number];

function SiteTable({ summaries }: { summaries: SiteSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2">現場名</th>
            <th className="px-4 py-2">緯度・経度</th>
            <th className="px-4 py-2">累計人工</th>
            <th className="px-4 py-2">累計稼働時間</th>
            <th className="px-4 py-2">最終稼働日</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(({ site, totalNinku, totalHours, lastWorkDate }) => (
            <tr key={site.id} className="border-t border-black/10 dark:border-white/10">
              <td className="px-4 py-2">
                <Link href={`/admin/reports?siteId=${site.id}`} className="text-blue-600 underline">
                  {site.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">
                {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
              </td>
              <td className="px-4 py-2 font-bold">{totalNinku}</td>
              <td className="px-4 py-2">{totalHours}h</td>
              <td className="px-4 py-2">{formatDate(lastWorkDate)}</td>
              <td className="px-4 py-2 text-right">
                <form action={setSiteActive.bind(null, site.id, !site.isActive)}>
                  <button type="submit" className="text-blue-600 underline">
                    {site.isActive ? "無効にする" : "有効にする"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {summaries.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-zinc-500">
                該当する現場はありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminSitesPage() {
  const summaries = await getSiteLifetimeSummaries();
  const activeSummaries = summaries.filter((s) => s.site.isActive);
  const inactiveSummaries = summaries.filter((s) => !s.site.isActive);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">現場一覧</h2>
        <Link href="/sites/new" className="text-blue-600 underline">
          + 現場を追加
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-500">稼働中の現場</h3>
        <SiteTable summaries={activeSummaries} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-500">
          過去の現場（作業終了・無効化済み）
        </h3>
        <SiteTable summaries={inactiveSummaries} />
      </section>
    </div>
  );
}
