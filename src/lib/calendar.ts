// 打刻カレンダー画面（従業員用・管理者用）で使う、月グリッドを組み立てる純粋関数。
// 日付そのものはjst-date.tsのjstMidnight（workDateと直接比較できる形）で持つ。
// 曜日・日数の計算自体はグレゴリオ暦の暦計算であり、サーバーの実行タイムゾーンに
// 依存しないため、jst-date.tsのnaiveLocalDateForJstと同様にDateのローカルgetterを使ってよい。

import { jstMidnight, shiftJstMonth } from "./jst-date";

export interface CalendarDay {
  date: Date; // その日の日本時間0時（workDateと比較できる）
  day: number; // 1-31
  inMonth: boolean; // 表示対象の月に属するか（前後の月の埋め日ならfalse）
  isToday: boolean;
  dayOfWeek: number; // 0=日, 1=月, ... 6=土
}

function daysInJstMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function makeCell(year: number, month: number, day: number, inMonth: boolean, today: Date): CalendarDay {
  const date = jstMidnight(year, month, day);
  return {
    date,
    day,
    inMonth,
    isToday: date.getTime() === today.getTime(),
    dayOfWeek: weekdayOf(year, month, day),
  };
}

// 指定した年月(1-12)のカレンダーを、日曜始まり7列×N週のグリッドとして返す。
// 週の頭・末は前後の月の日付で埋める（カレンダーとして違和感なく表示するため）。
export function buildCalendarWeeks(year: number, month: number, today: Date): CalendarDay[][] {
  const daysInMonth = daysInJstMonth(year, month);
  const firstWeekday = weekdayOf(year, month, 1);
  const prev = shiftJstMonth(year, month, -1);
  const daysInPrevMonth = daysInJstMonth(prev.year, prev.month);
  const next = shiftJstMonth(year, month, 1);

  const cells: CalendarDay[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    cells.push(makeCell(prev.year, prev.month, day, false, today));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(makeCell(year, month, day, true, today));
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(makeCell(next.year, next.month, nextDay, false, today));
    nextDay++;
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export const WEEKDAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;
