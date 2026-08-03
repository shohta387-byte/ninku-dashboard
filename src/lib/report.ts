import {
  calculateNinkuForEntry,
  getWorkedBreakKeysFromEntry,
  roundHours,
  roundNinku,
  type NinkuResult,
} from "./ninku";
import { jstMidnightFromInputValue, jstWeekdayIndex, toJstParts } from "./jst-date";

export type ReportGranularity = "day" | "week" | "month";

export interface ReportSourceEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  workDate: Date;
  clockIn: Date;
  clockOut: Date;
  workedBreak1: boolean;
  workedBreak2: boolean;
  workedBreak3: boolean;
  dailyReport?: string | null;
}

export interface ReportEntry extends ReportSourceEntry {
  ninku: NinkuResult;
}

// TimeEntry(退勤済みのもの)に人工計算を付与する。
export function toReportEntry(entry: ReportSourceEntry): ReportEntry {
  const workedBreakKeys = getWorkedBreakKeysFromEntry(entry);
  const ninku = calculateNinkuForEntry(entry.clockIn, entry.clockOut, workedBreakKeys);
  return { ...entry, ninku };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dayKey(date: Date): string {
  const { year, month, day } = toJstParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// その日が属する週の月曜日(日本時間)を週の代表キーとする。
export function weekKey(date: Date): string {
  const day = jstWeekdayIndex(date); // 0=日,1=月,...6=土
  const diffToMonday = (day + 6) % 7;
  // 日をまたぐ加減算はミリ秒の絶対時刻同士で行えば、日本時間にはサマータイムが無いため
  // タイムゾーンに関わらず常に正しく1日=24時間として計算できる。
  const monday = new Date(date.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
  return dayKey(monday);
}

export function monthKey(date: Date): string {
  const { year, month } = toJstParts(date);
  return `${year}-${pad2(month)}`;
}

export function periodKey(date: Date, granularity: ReportGranularity): string {
  if (granularity === "day") return dayKey(date);
  if (granularity === "week") return weekKey(date);
  return monthKey(date);
}

export function periodLabel(key: string, granularity: ReportGranularity): string {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return `${y}年${m}月`;
  }
  if (granularity === "week") {
    const start = jstMidnightFromInputValue(key);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `${dayKey(start)} 〜 ${dayKey(end)}`;
  }
  return key;
}

export interface PeriodSummary {
  key: string;
  label: string;
  totalNinku: number;
  totalHours: number;
  entryCount: number;
}

export function summarizeByPeriod(
  entries: ReportEntry[],
  granularity: ReportGranularity,
): PeriodSummary[] {
  const map = new Map<string, PeriodSummary>();
  for (const entry of entries) {
    const key = periodKey(entry.workDate, granularity);
    const existing = map.get(key);
    if (existing) {
      existing.totalNinku += entry.ninku.totalNinku;
      existing.totalHours += entry.ninku.workedHours;
      existing.entryCount += 1;
    } else {
      map.set(key, {
        key,
        label: periodLabel(key, granularity),
        totalNinku: entry.ninku.totalNinku,
        totalHours: entry.ninku.workedHours,
        entryCount: 1,
      });
    }
  }
  return [...map.values()]
    .map((p) => ({ ...p, totalNinku: roundNinku(p.totalNinku), totalHours: roundHours(p.totalHours) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  totalNinku: number;
  totalHours: number;
  entryCount: number;
}

export function summarizeByEmployee(entries: ReportEntry[]): EmployeeSummary[] {
  const map = new Map<string, EmployeeSummary>();
  for (const entry of entries) {
    const existing = map.get(entry.employeeId);
    if (existing) {
      existing.totalNinku += entry.ninku.totalNinku;
      existing.totalHours += entry.ninku.workedHours;
      existing.entryCount += 1;
    } else {
      map.set(entry.employeeId, {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        totalNinku: entry.ninku.totalNinku,
        totalHours: entry.ninku.workedHours,
        entryCount: 1,
      });
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, totalNinku: roundNinku(e.totalNinku), totalHours: roundHours(e.totalHours) }))
    .sort((a, b) => b.totalNinku - a.totalNinku);
}

export interface SiteSummary {
  siteId: string;
  siteName: string;
  totalNinku: number;
  totalHours: number;
  entryCount: number;
}

export function summarizeBySite(entries: ReportEntry[]): SiteSummary[] {
  const map = new Map<string, SiteSummary>();
  for (const entry of entries) {
    const existing = map.get(entry.siteId);
    if (existing) {
      existing.totalNinku += entry.ninku.totalNinku;
      existing.totalHours += entry.ninku.workedHours;
      existing.entryCount += 1;
    } else {
      map.set(entry.siteId, {
        siteId: entry.siteId,
        siteName: entry.siteName,
        totalNinku: entry.ninku.totalNinku,
        totalHours: entry.ninku.workedHours,
        entryCount: 1,
      });
    }
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalNinku: roundNinku(s.totalNinku), totalHours: roundHours(s.totalHours) }))
    .sort((a, b) => b.totalNinku - a.totalNinku);
}

export function sumNinku(entries: ReportEntry[]): number {
  return roundNinku(entries.reduce((sum, e) => sum + e.ninku.totalNinku, 0));
}

export function sumHours(entries: ReportEntry[]): number {
  return roundHours(entries.reduce((sum, e) => sum + e.ninku.workedHours, 0));
}
