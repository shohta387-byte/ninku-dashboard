import Link from "next/link";
import { getAdjustmentLogs, getEmployees } from "@/app/actions";
import { formatJstDate, formatJstDateTime, todayInJst, toJstInputValue, toJstParts } from "@/lib/jst-date";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function firstDayOfThisMonth(): string {
  const { year, month } = toJstParts(todayInJst());
  return `${year}-${pad2(month)}-01`;
}

function today(): string {
  return toJstInputValue(todayInJst());
}

export default async function AdjustmentLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const employeeId = params.employeeId || "";
  const from = params.from || firstDayOfThisMonth();
  const to = params.to || today();

  const [employees, logs] = await Promise.all([
    getEmployees(),
    getAdjustmentLogs({ employeeId: employeeId || undefined, from, to }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">修正履歴</h2>
        <p className="text-sm text-zinc-500">
          個別修正・ペア修正（現場の切り替わり）で行われた打刻の手動修正を、従業員・期間で絞り込んで確認できます。
        </p>
        <form className="flex flex-wrap items-end gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">従業員</span>
            <select
              name="employeeId"
              defaultValue={employeeId}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
            >
              <option value="">全従業員</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">開始日（対象打刻の勤務日）</span>
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
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-sm active:bg-blue-700"
          >
            検索
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">修正日時</th>
                <th className="px-4 py-2">勤務日</th>
                <th className="px-4 py-2">従業員</th>
                <th className="px-4 py-2">現場</th>
                <th className="px-4 py-2">修正者</th>
                <th className="px-4 py-2">理由</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{formatJstDateTime(log.createdAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-2">{formatJstDate(log.timeEntry.workDate, { month: "2-digit", day: "2-digit", weekday: "short" })}</td>
                  <td className="px-4 py-2">{log.timeEntry.employee.name}</td>
                  <td className="px-4 py-2">{log.timeEntry.site.name}</td>
                  <td className="px-4 py-2">{log.adjustedByEmail}</td>
                  <td className="px-4 py-2">{log.reason ?? ""}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/entries/${log.timeEntryId}`} className="text-blue-600 underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-zinc-500">
                    この条件に一致する修正履歴はありません。
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
