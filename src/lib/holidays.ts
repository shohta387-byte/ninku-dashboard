import * as holiday_jp from "@holiday-jp/holiday_jp";
import { naiveLocalDateForJst } from "./jst-date";

// 日本の祝日かどうかを判定する（土日は含まない。休日か平日かの判定は別途isWeekdayJstで行う）。
// instantは絶対時刻(true instant)を渡す。内部でJSTの日付に変換してから判定する。
export function isJapaneseHoliday(instant: Date): boolean {
  const naive = naiveLocalDateForJst(instant);
  return holiday_jp.between(naive, naive).length > 0;
}
