import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee, linkSelfAsEmployee } from "@/app/actions";
import { getSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.employeeId) {
    // 従業員に紐付いていない管理者専用アカウントは、そのまま管理者画面へ進むか、
    // その場で自分を従業員として登録して打刻も始められるようにする。
    if (session.isAdmin) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
          <TopBar label={session.email} isAdmin />
          <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <p className="text-sm text-zinc-500">
              このアカウントはまだ従業員として登録されていないため、打刻はできません。
              名前を登録すると、管理者のままご自身の打刻もできるようになります。
            </p>
            <form action={linkSelfAsEmployee} className="flex flex-col gap-3 pt-2">
              <input
                name="name"
                type="text"
                required
                placeholder="山田 太郎"
                className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white shadow-sm active:bg-blue-700"
              >
                この名前で登録して打刻もできるようにする
              </button>
            </form>
          </div>
          <Link href="/admin/reports" className="text-center text-sm text-blue-600 underline">
            打刻は不要なので、このまま管理者画面へ進む
          </Link>
        </main>
      );
    }
    redirect("/login?error=no_employee");
  }

  const employee = await getCurrentEmployee();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <TopBar label={employee.name} isAdmin={session.isAdmin} />
      <div>
        <h1 className="text-xl font-bold">{employee.name} さん、こんにちは</h1>
      </div>
      <Link
        href="/sites"
        className="w-full rounded-lg bg-blue-600 px-5 py-6 text-center text-xl font-bold text-white shadow-sm active:bg-blue-700"
      >
        現場を選んで打刻する
      </Link>
    </main>
  );
}
