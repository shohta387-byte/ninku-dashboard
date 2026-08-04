import Link from "next/link";
import { getCurrentEmployee, getSites, getTimeEntryById } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { toJstInputValue, formatJstTime } from "@/lib/jst-date";
import { ManualEntryForm } from "./manual-entry-form";

export default async function ManualEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ fromEntryId?: string }>;
}) {
  const { isAdmin, employeeId } = await requireEmployeeSession();
  const { fromEntryId } = await searchParams;
  const [employee, sites, fromEntry] = await Promise.all([
    getCurrentEmployee(),
    getSites(),
    fromEntryId ? getTimeEntryById(fromEntryId) : Promise.resolve(null),
  ]);

  // 自分の、退勤済みの打刻からの「続き」のみプリフィルに使う（他人の打刻や未退勤のものは対象外）。
  const prefill =
    fromEntry && fromEntry.employeeId === employeeId && fromEntry.clockOut
      ? { date: toJstInputValue(fromEntry.workDate), clockInTime: formatJstTime(fromEntry.clockOut, { hour: "2-digit", minute: "2-digit" }) }
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/sites" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">打刻を後から手動で追加する</h1>
      {prefill && (
        <p className="text-sm text-zinc-500">
          直前の打刻の退勤時刻（{prefill.date} {prefill.clockInTime}）を出勤時刻として入力しました。現場を選んでください。
        </p>
      )}
      {sites.length === 0 ? (
        <p className="text-zinc-500">現場が登録されていません。</p>
      ) : (
        <ManualEntryForm sites={sites} prefill={prefill ?? undefined} />
      )}
    </main>
  );
}
