// このアプリ全体は、サーバーの実行時タイムゾーンに関わらず「入力・保存・表示が常に
// 同じ基準でそろっている」という前提で日時を素朴に(new Date(y, m, d)のように)扱っている。
// このファイルの関数は、その前提を壊さないために、Asia/Tokyo基準の「今日」を
// アプリ内の他の日時（workDateなど）と同じ形（時刻情報を持たないローカルDate）で返す。
export function todayInJst(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(y, m - 1, d);
}

// 与えられた日付が日本時間で月曜〜金曜かどうか（dateはtodayInJst()などで作った
// 「時刻を持たないローカルDate」を想定しているので、そのままgetDay()を使えばよい）。
export function isWeekday(date: Date): boolean {
  const day = date.getDay(); // 0=日,1=月,...6=土
  return day >= 1 && day <= 5;
}
