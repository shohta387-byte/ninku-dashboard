import * as holiday_jp from "@holiday-jp/holiday_jp";

// 日本の祝日かどうかを判定する（土日は含まない。休日か平日かの判定は別途isWeekdayで行う）。
export function isJapaneseHoliday(date: Date): boolean {
  return holiday_jp.between(date, date).length > 0;
}
