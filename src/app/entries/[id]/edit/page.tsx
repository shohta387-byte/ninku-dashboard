import Link from "next/link";
import { notFound } from "next/navigation";
import { adjustTimeEntryForm, getTimeEntryById } from "@/app/actions";
import { roundToTimeStep } from "@/lib/ninku";
import { toJstParts } from "@/lib/jst-date";

function formatTimeStep(date: Date): string {
  const rounded = roundToTimeStep(date);
  const { hour, minute } = toJstParts(rounded);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getTimeEntryById(id);
  if (!entry) {
    notFound();
  }

  const options = generateTimeOptions();
  const defaultClockIn = entry.clockIn ? formatTimeStep(entry.clockIn) : "07:30";
  const defaultClockOut = entry.clockOut ? formatTimeStep(entry.clockOut) : "17:30";
  const action = adjustTimeEntryForm.bind(null, id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <Link href={`/clock?siteId=${entry.siteId}`} className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">時刻を修正する</h1>
      <form action={action} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">出勤時刻</span>
          <select
            name="clockInTime"
            defaultValue={defaultClockIn}
            className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">退勤時刻</span>
          <select
            name="clockOutTime"
            defaultValue={defaultClockOut}
            className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">補正理由（任意）</span>
          <input
            name="note"
            type="text"
            className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">日報（任意）</span>
          <textarea
            name="dailyReport"
            rows={3}
            defaultValue={entry.dailyReport ?? ""}
            placeholder="この日の作業内容など"
            className="rounded-lg border border-black/20 px-4 py-3 dark:border-white/20 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700"
        >
          保存する
        </button>
      </form>
    </main>
  );
}
