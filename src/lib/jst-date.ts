// このアプリは日本国内の現場勤怠を扱うため、日付・時刻は常に日本時間(JST, UTC+9)を
// 基準に解釈・保存・表示する。サーバーの実行タイムゾーン(Vercelなど本番環境ではUTCになる
// ことが多い)に依存すると、入力・保存・表示がすべて同じ基準でずれるため一見バグに気づき
// にくいが、実際には人によって出勤時刻が日付をまたぐ場合などに実害が出る。
// そのため、DBへの保存に使う「絶対時刻(instant)」の作成と、画面表示に使う「JSTでの
// 年月日時分」への変換は、必ずこのファイルの関数を経由し、date.getFullYear()や
// date.setHours()のようなサーバーのローカルタイムゾーンに依存する操作を直接使わない。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface JstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

// 絶対時刻(instant)から、日本時間での年月日時分を取り出す。
// サーバーの実行タイムゾーンに関わらず常に正しいJSTの値になる。
export function toJstParts(instant: Date): JstParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hourStr = get("hour");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hourStr === "24" ? 0 : Number(hourStr),
    minute: Number(get("minute")),
  };
}

// 日本時間の年月日時分から、対応する絶対時刻(instant)を作る。
// サーバーの実行タイムゾーンに関わらず常に正しい絶対時刻になる。
// DBに保存するclockIn/clockOut/workDateなどは、必ずこの関数(または下の派生関数)で作る。
export function fromJstParts(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - JST_OFFSET_MS);
}

// 日本時間での「その日の0時0分」を表す絶対時刻(workDateとして使う)。
export function jstMidnight(year: number, month: number, day: number): Date {
  return fromJstParts(year, month, day, 0, 0);
}

// 絶対時刻から、その時刻が属する日本時間での「その日の0時0分」を作る
// (workDateの正規化・当日判定などに使う)。
export function jstMidnightOf(instant: Date): Date {
  const { year, month, day } = toJstParts(instant);
  return jstMidnight(year, month, day);
}

// 今この瞬間が日本時間で属する日の0時0分。
export function todayInJst(): Date {
  return jstMidnightOf(new Date());
}

// "YYYY-MM-DD"形式の文字列(日付inputの値)を、日本時間のその日0時0分の絶対時刻に変換する。
export function jstMidnightFromInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return jstMidnight(y, m, d);
}

// 絶対時刻を、日本時間基準の"YYYY-MM-DD"形式の文字列にする(日付inputのdefaultValueなど)。
export function toJstInputValue(instant: Date): string {
  const { year, month, day } = toJstParts(instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 日本時間の年月日と"HH:MM"形式の時刻文字列から、絶対時刻を作る
// (手動打刻・代理打刻・時刻修正フォームの時刻選択に使う)。
export function jstDateTimeFromHHMM(
  dateParts: { year: number; month: number; day: number },
  hhmm: string,
): Date {
  const [h, mi] = hhmm.split(":").map(Number);
  return fromJstParts(dateParts.year, dateParts.month, dateParts.day, h, mi);
}

// 日本時間での曜日インデックス(0=日,1=月,...6=土)。
export function jstWeekdayIndex(instant: Date): number {
  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekdayStr];
}

// 日本時間で月曜〜金曜かどうか。
export function isWeekdayJst(instant: Date): boolean {
  const day = jstWeekdayIndex(instant);
  return day >= 1 && day <= 5;
}

export function formatJstDate(instant: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return instant.toLocaleDateString("ja-JP", { ...options, timeZone: "Asia/Tokyo" });
}

export function formatJstTime(instant: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return instant.toLocaleTimeString("ja-JP", { ...options, timeZone: "Asia/Tokyo" });
}

export function formatJstDateTime(instant: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return instant.toLocaleString("ja-JP", { ...options, timeZone: "Asia/Tokyo" });
}

export interface BillingPeriod {
  from: Date; // 期間開始日(21日)の日本時間0時
  to: Date; // 期間終了日(翌月20日)の日本時間0時
}

// 打刻は「21日〜翌月20日」締めで運用しているため、基準日(省略時は今日)が属する
// 締め期間を返す。21日以降ならその月の21日始まり、20日以前なら前月21日始まり。
export function currentBillingPeriod(referenceDate: Date = todayInJst()): BillingPeriod {
  const { year, month, day } = toJstParts(referenceDate);

  let startYear = year;
  let startMonth = month;
  if (day < 21) {
    startMonth -= 1;
    if (startMonth === 0) {
      startMonth = 12;
      startYear -= 1;
    }
  }

  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth === 13) {
    endMonth = 1;
    endYear += 1;
  }

  return {
    from: jstMidnight(startYear, startMonth, 21),
    to: jstMidnight(endYear, endMonth, 20),
  };
}

// @holiday-jp/holiday_jp はDateのgetFullYear/getMonth/getDate（サーバーの実行タイムゾーン
// 依存）で日付を読み取る作りのため、そのままだと本番(UTC実行)でJSTの祝日判定がずれる。
// 「ローカルgetterで読んだときにJSTの年月日になる」ようなDateを作って渡すことで、
// サーバーの実行タイムゾーンに関わらず正しく判定させる。
export function naiveLocalDateForJst(instant: Date): Date {
  const { year, month, day } = toJstParts(instant);
  return new Date(year, month - 1, day);
}
