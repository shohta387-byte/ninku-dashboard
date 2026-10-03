"use client";

import { useState } from "react";
import { AddSiteForm } from "./new/add-site-form";

type Contractor = { id: string; name: string };

// 打刻の途中（現場選択・次の現場へ移動・手動打刻）で、画面を離れずにその場で現場を追加する。
// 現場登録は<form>なので、呼び出し側の<form>の外に置くこと（formは入れ子にできない）。
export function InlineAddSite({
  contractors,
  onCreated,
}: {
  contractors: Contractor[];
  onCreated: (siteId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-black/20 px-5 py-3 text-center font-bold text-blue-600 active:bg-zinc-100 dark:border-white/20 dark:active:bg-zinc-800"
      >
        ＋ 一覧にない現場をここで追加する
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-center justify-between">
        <p className="font-bold">現場を追加する</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 underline">
          閉じる
        </button>
      </div>
      <AddSiteForm
        contractors={contractors}
        preferCurrentLocation
        onCreated={(siteId) => {
          setOpen(false);
          onCreated(siteId);
        }}
      />
    </div>
  );
}
