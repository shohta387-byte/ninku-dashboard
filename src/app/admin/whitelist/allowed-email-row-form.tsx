"use client";

import { useActionState } from "react";
import { updateAllowedEmail, updateEmployeeName, type AllowedEmailState, type UpdateEmployeeNameState } from "@/app/actions";

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
  const currentEmployee = employeesForRow.find((e) => e.id === defaultEmployeeId);

  return (
    <div className="flex flex-col gap-3">
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

      {currentEmployee && <RenameEmployeeForm employeeId={currentEmployee.id} defaultName={currentEmployee.name} />}
    </div>
  );
}

const renameInitialState: UpdateEmployeeNameState = { status: "idle", message: "" };

// メールアドレスとの紐付けはそのままに、既に紐付いている従業員の名前だけを変更する
// （表記ゆれの修正など）。上の紐付け変更フォームとは別の独立した操作にする。
function RenameEmployeeForm({ employeeId, defaultName }: { employeeId: string; defaultName: string }) {
  const action = updateEmployeeName.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, renameInitialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
      <span className="text-xs text-zinc-500">従業員名を変更（紐付けはそのまま）</span>
      <div className="flex gap-2">
        <input
          name="name"
          type="text"
          defaultValue={defaultName}
          className="flex-1 rounded-lg border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm text-blue-600 active:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:active:bg-zinc-800"
        >
          {isPending ? "保存中…" : "名前を変更する"}
        </button>
      </div>
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
    </form>
  );
}
