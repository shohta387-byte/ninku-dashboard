import Link from "next/link";

// 「一覧」「カレンダー」の切り替えタブ。単純な別ルートへのリンクなのでクライアント
// コンポーネントにする必要はない（現在地の判定はどちらのページから使われたかで決まる）。
export function EntriesViewTabs({ active }: { active: "list" | "calendar" }) {
  return (
    <div className="flex gap-2">
      <Link
        href="/entries"
        className={
          active === "list"
            ? "flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-bold text-white"
            : "flex-1 rounded-lg border border-black/10 px-4 py-2 text-center text-sm font-bold text-zinc-500 active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
        }
      >
        一覧
      </Link>
      <Link
        href="/entries/calendar"
        className={
          active === "calendar"
            ? "flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-bold text-white"
            : "flex-1 rounded-lg border border-black/10 px-4 py-2 text-center text-sm font-bold text-zinc-500 active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
        }
      >
        カレンダー
      </Link>
    </div>
  );
}
