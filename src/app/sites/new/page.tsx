import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCurrentUserLabel } from "@/app/actions";
import { TopBar } from "@/app/top-bar";
import { AdminNav } from "@/app/admin/admin-nav";
import { AddSiteForm } from "./add-site-form";

export default async function NewSitePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const label = await getCurrentUserLabel();
  // 従業員は現場選択画面へ、従業員に紐付いていない管理者専用アカウントは現場管理画面へ戻す。
  const backHref = session.employeeId ? "/sites" : "/admin/sites";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={label} isAdmin={session.isAdmin} />
      {session.isAdmin && <AdminNav />}
      <Link href={backHref} className="text-sm text-blue-600 underline">
        ← 戻る
      </Link>
      <h1 className="text-xl font-bold">現場を追加する</h1>
      <AddSiteForm />
    </main>
  );
}
