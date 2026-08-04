import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee, getSites, getTimeEntryById } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { getBreakWindowsWithinSpan } from "@/lib/ninku";
import { formatJstTime } from "@/lib/jst-date";
import { NextSiteForm } from "./next-site-form";

export default async function NextSitePage({
  searchParams,
}: {
  searchParams: Promise<{ entryId?: string }>;
}) {
  const { entryId } = await searchParams;
  if (!entryId) {
    redirect("/sites");
  }

  const { isAdmin, employeeId } = await requireEmployeeSession();
  const [employee, entry, allSites] = await Promise.all([
    getCurrentEmployee(),
    getTimeEntryById(entryId),
    getSites(),
  ]);

  if (!entry || entry.employeeId !== employeeId || !entry.clockIn || entry.clockOut) {
    redirect("/sites");
  }

  const eligibleBreaks = getBreakWindowsWithinSpan(entry.workDate, entry.clockIn, new Date());
  const nextSites = allSites.filter((s) => s.id !== entry.siteId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href={`/clock?siteId=${entry.siteId}`} className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">次の現場へ移動する</h1>
        <p className="text-sm text-zinc-500">
          出勤: {formatJstTime(entry.clockIn, { hour: "2-digit", minute: "2-digit" })}〜。
          今の現場の退勤と、選んだ現場の出勤が同じ時刻でまとめて記録されます。
        </p>
      </div>

      {nextSites.length === 0 ? (
        <p className="text-zinc-500">移動できる他の現場が登録されていません。</p>
      ) : (
        <NextSiteForm entryId={entry.id} eligibleBreaks={eligibleBreaks} sites={nextSites} />
      )}
    </main>
  );
}
