"use client";

import { useActionState, useRef, useState } from "react";
import { createManualTimeEntry, type ManualEntryState } from "@/app/actions";
import { BREAK_WINDOWS, getBreakWindowsWithinSpan } from "@/lib/ninku";
import { jstDateTimeFromHHMM, jstMidnightFromInputValue, toJstInputValue, todayInJst } from "@/lib/jst-date";

type Site = { id: string; name: string };

interface Block {
  key: number;
  date: string;
  clockInTime: string;
  clockOutTime: string;
}

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

// 選択された日付・出退勤時刻(いずれも日本時間)から、実際にその時間帯に含まれる休憩枠だけを算出する。
// 端末のタイムゾーン設定に関わらず常に日本時間として解釈するため、jst-date経由で組み立てる。
function eligibleBreakKeys(date: string, clockInTime: string, clockOutTime: string): Set<string> {
  if (!date) return new Set();
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return new Set();
  const workDate = jstMidnightFromInputValue(date);
  const clockIn = jstDateTimeFromHHMM({ year: y, month: m, day: d }, clockInTime);
  const clockOut = jstDateTimeFromHHMM({ year: y, month: m, day: d }, clockOutTime);
  if (clockOut <= clockIn) return new Set();
  return new Set(getBreakWindowsWithinSpan(workDate, clockIn, clockOut).map((w) => w.key));
}

const TIME_OPTIONS = generateTimeOptions();
const initialState: ManualEntryState = { status: "idle", message: "" };

export function ManualEntryForm({
  sites,
  prefill,
}: {
  sites: Site[];
  prefill?: { date: string; clockInTime: string };
}) {
  const [state, formAction, isPending] = useActionState(createManualTimeEntry, initialState);
  const nextKeyRef = useRef(1);
  const [blocks, setBlocks] = useState<Block[]>([
    {
      key: 0,
      date: prefill?.date ?? todayInputValue(),
      clockInTime: prefill?.clockInTime ?? "07:30",
      clockOutTime: "17:30",
    },
  ]);

  function updateBlock(key: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    setBlocks((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          key: nextKeyRef.current++,
          date: last?.date ?? todayInputValue(),
          clockInTime: "07:30",
          clockOutTime: "17:30",
        },
      ];
    });
  }

  function removeBlock(key: number) {
    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.key !== key) : prev));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {blocks.map((block, index) => (
        <div
          key={block.key}
          className="flex flex-col gap-5 rounded-lg border border-black/10 p-4 dark:border-white/10"
        >
          {blocks.length > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-zinc-500">{index + 1}件目の現場</p>
              <button
                type="button"
                onClick={() => removeBlock(block.key)}
                className="text-sm text-red-600 underline"
              >
                この現場を削除
              </button>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">現場</span>
            <select
              name={`siteId-${index}`}
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
              name={`date-${index}`}
              type="date"
              required
              value={block.date}
              max={todayInputValue()}
              onChange={(e) => updateBlock(block.key, { date: e.target.value })}
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">出勤時刻</span>
            <select
              name={`clockInTime-${index}`}
              value={block.clockInTime}
              onChange={(e) => updateBlock(block.key, { clockInTime: e.target.value })}
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
              name={`clockOutTime-${index}`}
              value={block.clockOutTime}
              onChange={(e) => updateBlock(block.key, { clockOutTime: e.target.value })}
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
            {(() => {
              const eligible = eligibleBreakKeys(block.date, block.clockInTime, block.clockOutTime);
              return BREAK_WINDOWS.map((w) => {
                const isEligible = eligible.has(w.key);
                return (
                  <label
                    key={w.key}
                    className={`flex items-center gap-3 text-lg ${isEligible ? "" : "text-zinc-400"}`}
                  >
                    <input
                      type="checkbox"
                      name={`${w.key}-${index}`}
                      className="h-6 w-6"
                      disabled={!isEligible}
                    />
                    {w.label} は休憩なしで稼働した
                  </label>
                );
              });
            })()}
            <p className="text-xs text-zinc-400">
              選択した出退勤時刻に含まれる休憩枠のみチェックできます。
            </p>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">メモ（任意）</span>
            <input
              name={`note-${index}`}
              type="text"
              placeholder="打刻を忘れたため後から入力"
              className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">日報（任意）</span>
            <textarea
              name={`dailyReport-${index}`}
              rows={3}
              placeholder="この日の作業内容など"
              className="rounded-lg border border-black/20 px-4 py-3 dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addBlock}
        className="w-full rounded-lg border border-dashed border-black/20 px-5 py-3 text-lg font-bold text-blue-600 active:bg-zinc-100 dark:border-white/20 dark:active:bg-zinc-800"
      >
        ＋現場を追加
      </button>
      <p className="-mt-3 text-xs text-zinc-400">
        同じ日に複数の現場で作業した場合など、まとめて登録できます。
      </p>

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
        {isPending ? "追加中…" : blocks.length > 1 ? `${blocks.length}件をまとめて追加する` : "追加する"}
      </button>
    </form>
  );
}
