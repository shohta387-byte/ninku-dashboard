"use client";

import { useActionState } from "react";
import { addAllowedEmail, type AllowedEmailState } from "@/app/actions";

type Employee = { id: string; name: string };

const initialState: AllowedEmailState = { status: "idle", message: "" };

export function AddAllowedEmailForm({ availableEmployees }: { availableEmployees: Employee[] }) {
  const [state, formAction, isPending] = useActionState(addAllowedEmail, initialState);

  return (
    <form
      action={formAction}
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

      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "追加中…" : "追加する"}
      </button>
    </form>
  );
}
