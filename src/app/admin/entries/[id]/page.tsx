import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdjustmentLogsForEntry,
  getEntriesForEmployeeDay,
  getEntryDetail,
  getSitesForAdmin,
} from "@/app/actions";
import { BREAK_WINDOWS, getWorkedBreakKeysFromEntry } from "@/lib/ninku";
import { formatJstDate, formatJstDateTime } from "@/lib/jst-date";
import { findNeighbors } from "@/lib/entry-pairs";

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

  const [dayEntries, logs, sites] = await Promise.all([
    getEntriesForEmployeeDay(entry.employeeId, entry.workDate),
    getAdjustmentLogsForEntry(id),
    getSitesForAdmin(),
  ]);
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));
  const { prev, next } = findNeighbors(dayEntries, id);

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
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200">補正履歴（最新）</h3>
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

      {(prev || next) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-zinc-500">現場の切り替わりを修正</h3>
          <div className="flex flex-col gap-2 text-sm">
            {prev && (
              <Link
                href={`/entries/pair/${prev.id}/${entry.id}?returnTo=/admin/entries/${entry.id}`}
                className="text-blue-600 underline"
              >
                前の現場との切り替え時刻をまとめて修正する
              </Link>
            )}
            {next && (
              <Link
                href={`/entries/pair/${entry.id}/${next.id}?returnTo=/admin/entries/${entry.id}`}
                className="text-blue-600 underline"
              >
                次の現場との切り替え時刻をまとめて修正する
              </Link>
            )}
          </div>
        </section>
      )}

      {logs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-zinc-500">修正履歴一覧（全{logs.length}件）</h3>
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-4 text-sm dark:border-white/10 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between text-zinc-500">
                  <span>{formatDateTime(log.createdAt)}</span>
                  <span>{log.adjustedByEmail}</span>
                </div>
                {log.beforeClockIn && log.afterClockIn && log.beforeClockIn.getTime() !== log.afterClockIn.getTime() && (
                  <p>出勤: {formatDateTime(log.beforeClockIn)} → {formatDateTime(log.afterClockIn)}</p>
                )}
                {log.beforeClockOut && log.afterClockOut && log.beforeClockOut.getTime() !== log.afterClockOut.getTime() && (
                  <p>退勤: {formatDateTime(log.beforeClockOut)} → {formatDateTime(log.afterClockOut)}</p>
                )}
                {log.beforeSiteId && log.afterSiteId && log.beforeSiteId !== log.afterSiteId && (
                  <p>
                    現場: {siteNameById.get(log.beforeSiteId) ?? log.beforeSiteId} → {siteNameById.get(log.afterSiteId) ?? log.afterSiteId}
                  </p>
                )}
                {log.reason && <p className="text-zinc-500">理由: {log.reason}</p>}
                {log.pairedLogId && <p className="text-xs text-zinc-400">現場切り替えのペア修正の一部</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
