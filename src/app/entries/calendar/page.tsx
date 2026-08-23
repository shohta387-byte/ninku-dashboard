import Link from "next/link";
import { getCurrentEmployee, getMyEntriesForMonth } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { todayInJst, toJstParts } from "@/lib/jst-date";
import { CalendarGrid } from "@/app/calendar-grid";
import { EntriesViewTabs } from "../entries-view-tabs";

export default async function EntriesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { isAdmin } = await requireEmployeeSession();
  const params = await searchParams;
  const today = todayInJst();
  const todayParts = toJstParts(today);

  const year = Number(params.year) || todayParts.year;
  const month = Number(params.month) || todayParts.month;

  const [employee, entries] = await Promise.all([
    getCurrentEmployee(),
    getMyEntriesForMonth(year, month),
  ]);

  const countByDay = new Map<number, number>();
  for (const entry of entries) {
    const key = entry.workDate.getTime();
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const canGoNext = year * 12 + month < todayParts.year * 12 + todayParts.month;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">打刻一覧</h1>
        <p className="text-sm text-zinc-500">
          日付をタップすると、その日の打刻の詳細・修正・削除ができます。
        </p>
      </div>

      <EntriesViewTabs active="calendar" />

      <CalendarGrid
        year={year}
        month={month}
        today={today}
        countByDay={countByDay}
        baseHref="/entries/calendar"
        canGoNext={canGoNext}
      />

      <Link href="/entries/manual" className="text-center text-sm text-blue-600 underline">
        打刻を後から手動で追加する
      </Link>
    </main>
  );
}
