"use client";

import { useActionState } from "react";
import { updateAllowedEmail, type AllowedEmailState } from "@/app/actions";

type Employee = { id: string; name: string };

const initialState: AllowedEmailState = { status: "idle", message: "" };

export function AllowedEmailRowForm({
  allowedId,
  employeesForRow,
  defaultEmployeeId,
  defaultIsAdmin,
}: {
  allowedId: string;
  employeesForRow: Employee[];
  defaultEmployeeId: string;
  defaultIsAdmin: boolean;
}) {
  const action = updateAllowedEmail.bind(null, allowedId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <select
        name="employeeId"
        defaultValue={defaultEmployeeId}
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
        <input type="checkbox" name="isAdmin" defaultChecked={defaultIsAdmin} className="h-5 w-5" />
        管理者権限
      </label>
      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="self-start text-blue-600 underline disabled:opacity-50">
        {isPending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
