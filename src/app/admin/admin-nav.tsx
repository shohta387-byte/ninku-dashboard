"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 管理者メニュー。項目が多いため用途ごとにまとめ、今いるページを強調表示する
// （現在地の判定にusePathnameを使うためクライアントコンポーネントにしている）。
const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "集計・確認",
    items: [
      { href: "/admin/reports", label: "レポート" },
      { href: "/admin/calendar", label: "カレンダー" },
      { href: "/admin/attendance", label: "従業員別勤怠" },
      { href: "/admin/adjustment-logs", label: "修正履歴" },
    ],
  },
  {
    label: "入力",
    items: [
      { href: "/admin/entries/new", label: "打刻の代理入力" },
      { href: "/sites/new", label: "現場を追加" },
    ],
  },
  {
    label: "登録・設定",
    items: [
      { href: "/admin/sites", label: "現場管理" },
      { href: "/admin/contractors", label: "元請け管理" },
      { href: "/admin/subcontractors", label: "外注管理" },
      { href: "/admin/whitelist", label: "ホワイトリスト" },
      { href: "/admin/reminder-emails", label: "喚起メール" },
      { href: "/admin/bigquery", label: "BigQuery連携" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-white/10">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1.5">
          <span className="w-full text-xs text-zinc-500 sm:w-20 sm:shrink-0">{group.label}</span>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white"
                    : "rounded-full border border-black/10 px-3 py-1 text-sm active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
