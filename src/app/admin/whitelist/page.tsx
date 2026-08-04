import { getAllowedEmails, getEmployees, removeAllowedEmail } from "@/app/actions";
import { AddAllowedEmailForm } from "./add-allowed-email-form";
import { AllowedEmailRowForm } from "./allowed-email-row-form";

export default async function WhitelistPage() {
  const [allowedEmails, employees] = await Promise.all([getAllowedEmails(), getEmployees()]);
  const linkedEmployeeIds = new Set(
    allowedEmails.filter((a) => a.employeeId).map((a) => a.employeeId),
  );
  const availableEmployees = employees.filter((e) => !linkedEmployeeIds.has(e.id));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">ログインを許可するGoogleアカウント</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">メールアドレス</th>
                <th className="px-4 py-2">従業員 / 管理者</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {allowedEmails.map((allowed) => {
                // 自分に紐付いている従業員は選択肢から消えないよう、他で使われていない従業員に加えて残す。
                const employeesForRow = employees.filter(
                  (e) => e.id === allowed.employeeId || !linkedEmployeeIds.has(e.id),
                );
                return (
                  <tr key={allowed.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-4 py-2 align-top">{allowed.email}</td>
                    <td className="px-4 py-2 align-top">
                      <AllowedEmailRowForm
                        allowedId={allowed.id}
                        employeesForRow={employeesForRow}
                        defaultEmployeeId={allowed.employeeId ?? ""}
                        defaultIsAdmin={allowed.isAdmin}
                      />
                    </td>
                    <td className="px-4 py-2 text-right align-top">
                      <form action={removeAllowedEmail.bind(null, allowed.id)}>
                        <button type="submit" className="text-red-600 underline">
                          削除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {allowedEmails.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-zinc-500">
                    登録されているメールアドレスはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-bold">新しく追加する</h2>
        <AddAllowedEmailForm availableEmployees={availableEmployees} />
      </section>
    </div>
  );
}
