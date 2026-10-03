"use client";

import { useActionState } from "react";
import { createContractor, type ContractorFormState } from "@/app/actions";

const initialState: ContractorFormState = { status: "idle", message: "" };

export function AddContractorForm() {
  const [state, formAction, isPending] = useActionState(createContractor, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">元請け名</span>
        <input
          key={state.status === "success" ? state.message : "input"}
          name="name"
          type="text"
          required
          placeholder="〇〇建設"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
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
        {isPending ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
