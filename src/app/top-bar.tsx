import Link from "next/link";
import { logout } from "@/app/actions";

export function TopBar({ label, isAdmin }: { label: string; isAdmin: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm text-zinc-500">
      <span>{label}</span>
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link href="/admin/reports" className="underline">
            管理者画面
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="underline">
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
