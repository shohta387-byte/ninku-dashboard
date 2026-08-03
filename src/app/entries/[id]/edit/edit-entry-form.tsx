"use client";

import { useActionState } from "react";
import { adjustTimeEntryForm, type AdjustEntryState } from "@/app/actions";

const initialState: AdjustEntryState = { status: "idle", message: "" };

export function EditEntryForm({
  entryId,
  options,
  defaultClockIn,
  defaultClockOut,
  defaultDailyReport,
}: {
  entryId: string;
  options: string[];
  defaultClockIn: string;
  defaultClockOut: string;
  defaultDailyReport: string;
}) {
  const action = adjustTimeEntryForm.bind(null, entryId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">出勤時刻</span>
        <select
          name="clockInTime"
          defaultValue={defaultClockIn}
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">退勤時刻</span>
        <select
          name="clockOutTime"
          defaultValue={defaultClockOut}
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">補正理由（任意）</span>
        <input
          name="note"
          type="text"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">日報（任意）</span>
        <textarea
          name="dailyReport"
          rows={3}
          defaultValue={defaultDailyReport}
          placeholder="この日の作業内容など"
          className="rounded-lg border border-black/20 px-4 py-3 dark:border-white/20 dark:bg-zinc-900"
        />
      </label>

      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}
