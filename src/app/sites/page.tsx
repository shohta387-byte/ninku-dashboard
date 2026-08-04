import Link from "next/link";
import { getCurrentEmployee, getSites } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { SitePicker } from "./site-picker";

export default async function SitesPage() {
  const { isAdmin } = await requireEmployeeSession();
  const employee = await getCurrentEmployee();
  const sites = await getSites();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">現場を選んでください</h1>
      <SitePicker sites={sites} />
      {sites.length === 0 && <p className="text-zinc-500">現場が登録されていません。</p>}
      <Link href="/sites/new" className="text-center text-sm text-blue-600 underline">
        新しい現場を追加する
      </Link>
    </main>
  );
}
