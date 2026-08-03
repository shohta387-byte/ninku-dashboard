import Link from "next/link";
import { getCurrentEmployee, getSites } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { ManualEntryForm } from "./manual-entry-form";

export default async function ManualEntryPage() {
  const { isAdmin } = await requireEmployeeSession();
  const [employee, sites] = await Promise.all([getCurrentEmployee(), getSites()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/sites" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">打刻を後から手動で追加する</h1>
      {sites.length === 0 ? (
        <p className="text-zinc-500">現場が登録されていません。</p>
      ) : (
        <ManualEntryForm sites={sites} />
      )}
    </main>
  );
}
