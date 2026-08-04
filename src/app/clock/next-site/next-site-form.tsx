"use client";

import { useActionState } from "react";
import { moveToNextSite, type MoveToNextSiteState } from "@/app/actions";
import type { BreakWindow } from "@/lib/ninku";

type Site = { id: string; name: string };

const initialState: MoveToNextSiteState = { status: "idle", message: "" };

export function NextSiteForm({
  entryId,
  eligibleBreaks,
  sites,
}: {
  entryId: string;
  eligibleBreaks: BreakWindow[];
  sites: Site[];
}) {
  const action = moveToNextSite.bind(null, entryId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">次の現場</span>
        <select
          name="nextSiteId"
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

      <fieldset className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <legend className="px-1 text-sm text-zinc-500">
          今の現場で、休憩が取れなかった時間帯があればチェック（稼働として人工に加算されます）
        </legend>
        {eligibleBreaks.map((w) => (
          <label key={w.key} className="flex items-center gap-3 text-lg">
            <input type="checkbox" name={w.key} className="h-6 w-6" />
            {w.label} は休憩なしで稼働した
          </label>
        ))}
        {eligibleBreaks.length === 0 && (
          <p className="text-sm text-zinc-500">現在の勤務時間には定時休憩が含まれていません。</p>
        )}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">日報（任意、今の現場の分）</span>
        <textarea
          name="dailyReport"
          rows={3}
          placeholder="今の現場での作業内容など"
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
        className="w-full rounded-lg bg-blue-600 px-5 py-6 text-xl font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "処理中…" : "この現場を退勤して次の現場へ移動する"}
      </button>
    </form>
  );
}
