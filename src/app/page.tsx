import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/app/actions";
import { getSession } from "@/lib/session";
import { TopBar } from "@/app/top-bar";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.employeeId) {
    // 従業員に紐付いていないアカウント（管理者専用アカウントなど）は、
    // 打刻画面ではなく管理者画面へ案内する。
    if (session.isAdmin) {
      redirect("/admin/reports");
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
