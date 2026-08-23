import { getAllEntriesForMonth } from "@/app/actions";
import { todayInJst, toJstParts } from "@/lib/jst-date";
import { CalendarGrid } from "@/app/calendar-grid";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const today = todayInJst();
  const todayParts = toJstParts(today);

  const year = Number(params.year) || todayParts.year;
  const month = Number(params.month) || todayParts.month;

  const entries = await getAllEntriesForMonth(year, month);

  const countByDay = new Map<number, number>();
  for (const entry of entries) {
    const key = entry.workDate.getTime();
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const canGoNext = year * 12 + month < todayParts.year * 12 + todayParts.month;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">全従業員の打刻カレンダー</h2>
        <p className="text-sm text-zinc-500">
          日付をタップすると、その日の全従業員分の打刻の詳細・削除ができます。
        </p>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        today={today}
        countByDay={countByDay}
        baseHref="/admin/calendar"
        canGoNext={canGoNext}
      />
    </div>
  );
}
