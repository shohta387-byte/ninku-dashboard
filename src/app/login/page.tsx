const ERROR_MESSAGES: Record<string, string> = {
  not_allowed:
    "このGoogleアカウントは登録されていません。管理者にメールアドレスの登録を依頼してください。",
  no_employee:
    "ログインは成功しましたが、従業員としての登録が見つかりません。管理者に確認してください。",
  forbidden: "この画面には管理者権限が必要です。",
  verification_failed: "Googleアカウントの確認に失敗しました。もう一度お試しください。",
  invalid_request: "ログイン処理が正しく完了しませんでした。もう一度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.invalid_request) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-bold">人工管理システム</h1>
        <p className="text-sm text-zinc-500">Googleアカウントでログインしてください</p>
      </div>

      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <a
        href="/api/auth/google/start"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700"
      >
        Googleでログイン
      </a>
    </main>
  );
}
