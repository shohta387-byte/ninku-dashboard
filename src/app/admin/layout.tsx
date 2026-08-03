import Link from "next/link";
import { requireAdminSession } from "@/lib/session";
import { logout } from "@/app/actions";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <Link href="/" className="underline">
          打刻画面へ戻る
        </Link>
        <form action={logout}>
          <button type="submit" className="underline">
            ログアウト
          </button>
        </form>
      </div>
      <h1 className="text-xl font-bold">管理者画面</h1>
      <AdminNav />
      {children}
    </main>
  );
}
