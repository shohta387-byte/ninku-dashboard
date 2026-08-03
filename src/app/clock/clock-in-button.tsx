"use client";

import { useActionState } from "react";
import { clockIn, type ClockInState } from "@/app/actions";

const initialState: ClockInState = { status: "idle", message: "" };

export function ClockInButton({ siteId }: { siteId: string }) {
  const action = clockIn.bind(null, siteId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-5 py-6 text-xl font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "処理中…" : "作業開始（入場）"}
      </button>
    </form>
  );
}
