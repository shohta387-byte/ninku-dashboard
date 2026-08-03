import {
  addAllowedEmail,
  getAllowedEmails,
  getEmployees,
  removeAllowedEmail,
  updateAllowedEmail,
} from "@/app/actions";

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
                      <form
                        action={updateAllowedEmail.bind(null, allowed.id)}
                        className="flex flex-col gap-2"
                      >
                        <select
                          name="employeeId"
                          defaultValue={allowed.employeeId ?? ""}
                          className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
                        >
                          <option value="">紐付けない（管理者専用アカウント）</option>
                          {employeesForRow.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="newEmployeeName"
                          type="text"
                          placeholder="新しい従業員名で登録する場合はこちらに入力"
                          className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="isAdmin"
                            defaultChecked={allowed.isAdmin}
                            className="h-5 w-5"
                          />
                          管理者権限
                        </label>
                        <button type="submit" className="self-start text-blue-600 underline">
                          保存
                        </button>
                      </form>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">新しく追加する</h2>
        <form
          action={addAllowedEmail}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">Googleアカウントのメールアドレス</span>
            <input
              name="email"
              type="email"
              required
              placeholder="taro.yamada@gmail.com"
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">既存の従業員に紐付ける（任意）</span>
            <select
              name="employeeId"
              defaultValue=""
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            >
              <option value="">紐付けない（管理者専用アカウント）</option>
              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">
              または、新しい従業員として登録する（上のプルダウンとは同時に使えません）
            </span>
            <input
              name="newEmployeeName"
              type="text"
              placeholder="山田 太郎"
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" name="isAdmin" className="h-6 w-6" />
            管理者権限を付与する
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700"
          >
            追加する
          </button>
        </form>
      </section>
    </div>
  );
}
