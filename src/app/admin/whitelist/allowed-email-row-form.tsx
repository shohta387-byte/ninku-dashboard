"use client";

import { useActionState } from "react";
import {
  updateAllowedEmail,
  updateEmployeeName,
  updateEmployeeNationality,
  type AllowedEmailState,
  type UpdateEmployeeNameState,
  type UpdateEmployeeNationalityState,
} from "@/app/actions";

type Employee = { id: string; name: string; nationality: "JAPANESE" | "FOREIGN" | null };

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
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500">国籍（新規登録時のみ）</span>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="nationality" value="JAPANESE" />
            日本人
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="nationality" value="FOREIGN" />
            外国人
          </label>
        </div>
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

      {currentEmployee && (
        <>
          <RenameEmployeeForm employeeId={currentEmployee.id} defaultName={currentEmployee.name} />
          <NationalityForm employeeId={currentEmployee.id} defaultNationality={currentEmployee.nationality} />
        </>
      )}
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

const nationalityInitialState: UpdateEmployeeNationalityState = { status: "idle", message: "" };

// 国籍を設定・変更する。移行前から登録されている従業員は国籍が未設定のままなので、
// ここから後付けで設定できるようにする。
function NationalityForm({
  employeeId,
  defaultNationality,
}: {
  employeeId: string;
  defaultNationality: "JAPANESE" | "FOREIGN" | null;
}) {
  const action = updateEmployeeNationality.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, nationalityInitialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
      <span className="text-xs text-zinc-500">
        国籍{defaultNationality ? "（現在: " + (defaultNationality === "JAPANESE" ? "日本人" : "外国人") + "）" : "（未設定）"}
      </span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="nationality" value="JAPANESE" defaultChecked={defaultNationality === "JAPANESE"} />
          日本人
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="nationality" value="FOREIGN" defaultChecked={defaultNationality === "FOREIGN"} />
          外国人
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm text-blue-600 active:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:active:bg-zinc-800"
        >
          {isPending ? "保存中…" : "設定する"}
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
