import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntryDetail } from "@/app/actions";
import { BREAK_WINDOWS, getWorkedBreakKeysFromEntry } from "@/lib/ninku";
import { formatJstDate, formatJstDateTime } from "@/lib/jst-date";

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return formatJstDateTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date): string {
  return formatJstDate(date, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default async function AdminEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEntryDetail(id);
  if (!detail) {
    notFound();
  }

  const { entry, ninku } = detail;
  const workedBreakKeys = getWorkedBreakKeysFromEntry(entry);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/admin/reports" className="text-sm text-blue-600 underline">
        ← レポートに戻る
      </Link>
      <h2 className="text-lg font-bold">打刻詳細</h2>

      <section className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <p>
          <span className="text-zinc-500">従業員: </span>
          {entry.employee.name}
        </p>
        <p>
          <span className="text-zinc-500">現場: </span>
          {entry.site.name}
        </p>
        <p>
          <span className="text-zinc-500">日付: </span>
          {formatDate(entry.workDate)}
        </p>
        <p>
          <span className="text-zinc-500">出勤〜退勤: </span>
          {formatDateTime(entry.clockIn)} 〜 {formatDateTime(entry.clockOut)}
        </p>
        {ninku && (
          <>
            <p>
              <span className="text-zinc-500">稼働時間: </span>
              {ninku.workedHours}h（うち時間外 {ninku.overtimeHours}h）
            </p>
            <p className="text-lg font-bold">人工: {ninku.totalNinku}</p>
          </>
        )}
        {workedBreakKeys.length > 0 && (
          <p>
            <span className="text-zinc-500">休憩なしで稼働: </span>
            {workedBreakKeys
              .map((k) => BREAK_WINDOWS.find((w) => w.key === k)!.label)
              .join("、")}
          </p>
        )}
      </section>

      {entry.dailyReport && (
        <section className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <h3 className="text-sm font-bold text-zinc-500">日報</h3>
          <p className="whitespace-pre-wrap">{entry.dailyReport}</p>
        </section>
      )}

      {entry.isManuallyAdjusted && (
        <section className="flex flex-col gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-5 text-sm dark:border-yellow-800 dark:bg-yellow-950">
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200">補正履歴</h3>
          {entry.originalClockIn && entry.originalClockOut && (
            <p>
              補正前: {formatDateTime(entry.originalClockIn)} 〜{" "}
              {formatDateTime(entry.originalClockOut)}
            </p>
          )}
          {entry.adjustmentNote && <p>理由: {entry.adjustmentNote}</p>}
          {entry.adjustedByName && <p>補正者: {entry.adjustedByName}</p>}
          {entry.adjustedAt && <p>補正日時: {formatDateTime(entry.adjustedAt)}</p>}
        </section>
      )}
    </div>
  );
}
