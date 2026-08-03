"use client";

import { useActionState } from "react";
import { syncToBigQueryAction, type SyncBigQueryState } from "@/app/actions";

const initialState: SyncBigQueryState = { status: "idle", message: "" };

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncToBigQueryAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "同期中…" : "今すぐBigQueryへ同期する"}
      </button>
      {state.status === "success" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
