"use client";

import { useActionState } from "react";
import { createSubcontractor, type CreateSubcontractorState } from "@/app/actions";

const initialState: CreateSubcontractorState = { status: "idle", message: "" };

export function AddSubcontractorForm() {
  const [state, formAction, isPending] = useActionState(createSubcontractor, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">会社名</span>
        <input
          name="name"
          type="text"
          required
          placeholder="〇〇興業"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
      </label>
      <p className="text-xs text-zinc-400">
        国籍(日本人／外国人)はここでは選びません。代理で打刻するたびに選びます
        （同じ会社でも日によってチームの国籍が変わることがあるため）。
      </p>

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
