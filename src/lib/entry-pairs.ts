// 「現場の切り替わり」のペア修正で使う、隣接する打刻を検出するための純粋関数群。
// 同じ従業員・同じ日の打刻を出勤時刻順に並べたとき、時間的に隣り合っている2件を
// 「境界」とみなす。出勤時刻が無い（異常データ）ものは対象外にする。

export interface EntryForPairing {
  id: string;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
}

function sortSameDay<T extends EntryForPairing>(entries: T[], workDate: Date): T[] {
  return entries
    .filter((e) => e.clockIn && e.workDate.getTime() === workDate.getTime())
    .sort((a, b) => a.clockIn!.getTime() - b.clockIn!.getTime());
}

// 与えられた打刻一覧（複数の日・複数の従業員が混在していても良い）から、
// 同じ従業員・同じ日で時刻順に隣り合っている全てのペアを返す。
// 呼び出し側で対象を1人分に絞り込んでから渡すことを想定している。
export function findAdjacentEntryPairs<T extends EntryForPairing>(entries: T[]): Array<{ a: T; b: T }> {
  const byDay = new Map<number, T[]>();
  for (const e of entries) {
    if (!e.clockIn) continue;
    const key = e.workDate.getTime();
    const list = byDay.get(key);
    if (list) {
      list.push(e);
    } else {
      byDay.set(key, [e]);
    }
  }

  const pairs: Array<{ a: T; b: T }> = [];
  for (const [dayTime, list] of byDay) {
    const sorted = sortSameDay(list, new Date(dayTime));
    for (let i = 0; i < sorted.length - 1; i++) {
      pairs.push({ a: sorted[i], b: sorted[i + 1] });
    }
  }
  return pairs;
}

// 特定の打刻(entryId)について、同じ従業員・同じ日の中で直前・直後に隣接する打刻を返す。
// entriesにはその従業員のその日の打刻のみを渡すこと（複数の従業員が混在していると誤判定する）。
export function findNeighbors<T extends EntryForPairing & { id: string }>(
  entries: T[],
  entryId: string,
): { prev: T | null; next: T | null } {
  const target = entries.find((e) => e.id === entryId);
  if (!target || !target.clockIn) {
    return { prev: null, next: null };
  }

  const sameDay = sortSameDay(entries, target.workDate);
  const idx = sameDay.findIndex((e) => e.id === entryId);
  if (idx === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: idx > 0 ? sameDay[idx - 1] : null,
    next: idx < sameDay.length - 1 ? sameDay[idx + 1] : null,
  };
}
