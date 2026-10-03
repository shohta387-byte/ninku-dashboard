import Link from "next/link";
import { getActiveContractors, getCurrentEmployee, getSites } from "@/app/actions";
import { requireEmployeeSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";
import { SitePicker } from "./site-picker";

export default async function SitesPage() {
  const { isAdmin } = await requireEmployeeSession();
  const [employee, sites, contractors] = await Promise.all([
    getCurrentEmployee(),
    getSites(),
    getActiveContractors(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <TopBar label={employee.name} isAdmin={isAdmin} />
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">現場を選んでください</h1>
      {sites.length === 0 && <p className="text-zinc-500">現場が登録されていません。</p>}
      <SitePicker sites={sites} contractors={contractors} />
    </main>
  );
}
