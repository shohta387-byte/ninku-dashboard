import { getEmployeesForReminderSettings, setReminderEmailEnabled } from "@/app/actions";

export default async function ReminderEmailsPage() {
  const employees = await getEmployeesForReminderSettings();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-bold">喚起メール</h2>
      <p className="max-w-2xl text-sm text-zinc-500">
        土日祝を除く平日19:30の時点で、その日の打刻が1件も無い従業員に「打刻を忘れていないでしょうか？」という確認メールを、
        登録されているGoogleアカウント宛に自動で送信します。従業員ごとに送信のオン・オフを切り替えられます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">従業員</th>
              <th className="px-4 py-2">送信先メールアドレス</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const email = employee.allowedEmail?.email;
              return (
                <tr key={employee.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{employee.name}</td>
                  <td className="px-4 py-2">
                    {email ? (
                      email
                    ) : (
                      <span className="text-zinc-400">
                        未登録（ホワイトリストでGoogleアカウントを紐付けてください）
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!email ? (
                      <span className="text-zinc-400">対象外</span>
                    ) : employee.reminderEmailEnabled ? (
                      <span className="font-bold text-green-700 dark:text-green-400">送信する</span>
                    ) : (
                      <span className="text-zinc-500">送信しない</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {email && (
                      <form
                        action={setReminderEmailEnabled.bind(
                          null,
                          employee.id,
                          !employee.reminderEmailEnabled,
                        )}
                      >
                        <button type="submit" className="text-blue-600 underline">
                          {employee.reminderEmailEnabled ? "送信しないにする" : "送信するにする"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-zinc-500">
                  従業員が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
