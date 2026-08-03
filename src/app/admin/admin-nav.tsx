import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-4 border-b border-black/10 pb-3 text-sm dark:border-white/10">
      <Link href="/admin/reports" className="underline">
        レポート
      </Link>
      <Link href="/admin/sites" className="underline">
        現場管理
      </Link>
      <Link href="/admin/entries/new" className="underline">
        従業員の打刻を代理入力
      </Link>
      <Link href="/sites/new" className="underline">
        現場を追加
      </Link>
      <Link href="/admin/whitelist" className="underline">
        ホワイトリスト
      </Link>
      <Link href="/admin/reminder-emails" className="underline">
        喚起メール
      </Link>
      <Link href="/admin/bigquery" className="underline">
        BigQuery連携
      </Link>
    </nav>
  );
}
