import Link from "next/link";
import { notFound } from "next/navigation";
import { getTimeEntryById } from "@/app/actions";
import { roundToTimeStep } from "@/lib/ninku";
import { toJstParts } from "@/lib/jst-date";
import { EditEntryForm } from "./edit-entry-form";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <Link href={`/clock?siteId=${entry.siteId}`} className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">時刻を修正する</h1>
      <EditEntryForm
        entryId={id}
        options={options}
        defaultClockIn={defaultClockIn}
        defaultClockOut={defaultClockOut}
        defaultDailyReport={entry.dailyReport ?? ""}
      />
    </main>
  );
}
