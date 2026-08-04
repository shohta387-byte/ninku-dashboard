"use client";

import { useActionState, useState } from "react";
import { adjustEntryPair, type AdjustPairState } from "@/app/actions";

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();
const initialState: AdjustPairState = { status: "idle", message: "" };

export function PairCorrectionForm({
  entryAId,
  entryBId,
  defaultTime,
  returnTo,
}: {
  entryAId: string;
  entryBId: string;
  defaultTime: string;
  returnTo: string;
}) {
  const action = adjustEntryPair.bind(null, entryAId, entryBId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [independent, setIndependent] = useState(false);
  const [sharedTime, setSharedTime] = useState(defaultTime);
  const [timeA, setTimeA] = useState(defaultTime);
  const [timeB, setTimeB] = useState(defaultTime);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {!independent && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">切替時刻（A現場の退勤・B現場の出勤に同じ時刻を使います）</span>
          <select
            value={sharedTime}
            onChange={(e) => setSharedTime(e.target.value)}
            className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )}

      {independent && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">A現場の退勤時刻</span>
            <select
              value={timeA}
              onChange={(e) => setTimeA(e.target.value)}
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">B現場の出勤時刻</span>
            <select
              value={timeB}
              onChange={(e) => setTimeB(e.target.value)}
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <input type="hidden" name="clockOutATime" value={independent ? timeA : sharedTime} />
      <input type="hidden" name="clockInBTime" value={independent ? timeB : sharedTime} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <label className="flex items-center gap-3 text-sm text-zinc-500">
        <input
          type="checkbox"
          checked={independent}
          onChange={(e) => setIndependent(e.target.checked)}
          className="h-5 w-5"
        />
        それぞれ別々の時刻にする（通常は移動時間を含めて同時刻にします）
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">修正理由（任意）</span>
        <input
          name="reason"
          type="text"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
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
        {isPending ? "保存中…" : "まとめて保存する"}
      </button>
    </form>
  );
}
