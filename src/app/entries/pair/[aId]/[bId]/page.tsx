import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEntryPairForCorrection, getCurrentUserLabel } from "@/app/actions";
import { getSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { AdminNav } from "@/app/admin/admin-nav";
import { formatJstDate, formatJstTime, toJstParts } from "@/lib/jst-date";
import { roundToTimeStep } from "@/lib/ninku";
import { PairCorrectionForm } from "./pair-correction-form";

function formatTimeStep(date: Date): string {
  const rounded = roundToTimeStep(date);
  const { hour, minute } = toJstParts(rounded);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default async function PairCorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ aId: string; bId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { aId, bId } = await params;
  const { returnTo } = await searchParams;
  const [pair, label] = await Promise.all([getEntryPairForCorrection(aId, bId), getCurrentUserLabel()]);
  if (!pair) {
    notFound();
  }
  const { entryA, entryB } = pair;
  if (!entryA.clockIn || !entryA.clockOut) {
    notFound();
  }

  const defaultTime = formatTimeStep(entryA.clockOut);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={label} isAdmin={session.isAdmin} />
      {session.isAdmin && <AdminNav />}
      <Link href={returnTo ?? "/entries"} className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">現場の切り替え時刻を修正する</h1>
        <p className="text-sm text-zinc-500">{formatJstDate(entryA.workDate, { month: "2-digit", day: "2-digit", weekday: "short" })}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm dark:border-white/10 dark:bg-zinc-900">
        <p>
          A: <span className="font-bold">{entryA.site.name}</span>（退勤: {formatJstTime(entryA.clockOut, { hour: "2-digit", minute: "2-digit" })}）
        </p>
        <p>
          B: <span className="font-bold">{entryB.site.name}</span>（出勤:{" "}
          {entryB.clockIn ? formatJstTime(entryB.clockIn, { hour: "2-digit", minute: "2-digit" }) : "—"}）
        </p>
      </div>

      <PairCorrectionForm entryAId={entryA.id} entryBId={entryB.id} defaultTime={defaultTime} returnTo={returnTo ?? "/entries"} />
    </main>
  );
}
