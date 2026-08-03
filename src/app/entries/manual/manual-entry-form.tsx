"use client";

import { useActionState, useMemo, useState } from "react";
import { createManualTimeEntry, type ManualEntryState } from "@/app/actions";
import { BREAK_WINDOWS, getBreakWindowsWithinSpan } from "@/lib/ninku";
import { jstDateTimeFromHHMM, jstMidnightFromInputValue, toJstInputValue, todayInJst } from "@/lib/jst-date";

type Site = { id: string; name: string };

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

function todayInputValue(): string {
  return toJstInputValue(todayInJst());
}

const TIME_OPTIONS = generateTimeOptions();
const initialState: ManualEntryState = { status: "idle", message: "" };

export function ManualEntryForm({ sites }: { sites: Site[] }) {
  const [state, formAction, isPending] = useActionState(createManualTimeEntry, initialState);
  const [date, setDate] = useState(todayInputValue());
  const [clockInTime, setClockInTime] = useState("07:30");
  const [clockOutTime, setClockOutTime] = useState("17:30");

  // 選択された日付・出退勤時刻(いずれも日本時間)から、実際にその時間帯に含まれる休憩枠だけを算出する。
  // 端末のタイムゾーン設定に関わらず常に日本時間として解釈するため、jst-date経由で組み立てる。
  const eligibleKeys = useMemo(() => {
    if (!date) return new Set<string>();
    const workDate = jstMidnightFromInputValue(date);
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return new Set<string>();
    const clockIn = jstDateTimeFromHHMM({ year: y, month: m, day: d }, clockInTime);
    const clockOut = jstDateTimeFromHHMM({ year: y, month: m, day: d }, clockOutTime);
    if (clockOut <= clockIn) return new Set<string>();
    return new Set(getBreakWindowsWithinSpan(workDate, clockIn, clockOut).map((w) => w.key));
  }, [date, clockInTime, clockOutTime]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">現場</span>
        <select
          name="siteId"
          required
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">日付</span>
        <input
          name="date"
          type="date"
          required
          value={date}
          max={todayInputValue()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">出勤時刻</span>
        <select
          name="clockInTime"
          value={clockInTime}
          onChange={(e) => setClockInTime(e.target.value)}
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
        <span className="text-sm text-zinc-500">退勤時刻</span>
        <select
          name="clockOutTime"
          value={clockOutTime}
          onChange={(e) => setClockOutTime(e.target.value)}
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        >
          {TIME_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm text-zinc-500">
          休憩が取れなかった時間帯があればチェック
        </legend>
        {BREAK_WINDOWS.map((w) => {
          const eligible = eligibleKeys.has(w.key);
          return (
            <label
              key={w.key}
              className={`flex items-center gap-3 text-lg ${eligible ? "" : "text-zinc-400"}`}
            >
              <input type="checkbox" name={w.key} className="h-6 w-6" disabled={!eligible} />
              {w.label} は休憩なしで稼働した
            </label>
          );
        })}
        <p className="text-xs text-zinc-400">
          選択した出退勤時刻に含まれる休憩枠のみチェックできます。
        </p>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">メモ（任意）</span>
        <input
          name="note"
          type="text"
          placeholder="打刻を忘れたため後から入力"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">日報（任意）</span>
        <textarea
          name="dailyReport"
          rows={3}
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
        {isPending ? "追加中…" : "追加する"}
      </button>
    </form>
  );
}
