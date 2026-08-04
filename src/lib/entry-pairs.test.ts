import { describe, expect, it } from "vitest";
import { findAdjacentEntryPairs, findNeighbors, type EntryForPairing } from "./entry-pairs";
import { fromJstParts, jstMidnight } from "./jst-date";

interface Entry extends EntryForPairing {
  id: string;
}

function entry(id: string, day: Date, clockInHour: number, clockOutHour: number | null): Entry {
  return {
    id,
    workDate: day,
    clockIn: fromJstParts(2026, 8, 3, clockInHour, 0),
    clockOut: clockOutHour === null ? null : fromJstParts(2026, 8, 3, clockOutHour, 0),
  };
}

describe("findAdjacentEntryPairs", () => {
  it("pairs up three same-day entries into two consecutive boundaries", () => {
    const day = jstMidnight(2026, 8, 3);
    const a = entry("a", day, 7, 12);
    const b = entry("b", day, 12, 15);
    const c = entry("c", day, 15, 18);
    const pairs = findAdjacentEntryPairs([c, a, b]); // 入力順はバラバラでもよい

    expect(pairs).toHaveLength(2);
    expect(pairs[0].a.id).toBe("a");
    expect(pairs[0].b.id).toBe("b");
    expect(pairs[1].a.id).toBe("b");
    expect(pairs[1].b.id).toBe("c");
  });

  it("does not pair entries from different days", () => {
    const day1 = jstMidnight(2026, 8, 3);
    const day2 = jstMidnight(2026, 8, 4);
    const a = entry("a", day1, 7, 17);
    const b = { ...entry("b", day2, 7, 17) };
    const pairs = findAdjacentEntryPairs([a, b]);
    expect(pairs).toHaveLength(0);
  });

  it("skips entries without a clockIn (not yet started)", () => {
    const day = jstMidnight(2026, 8, 3);
    const a = entry("a", day, 7, 12);
    const broken: Entry = { id: "broken", workDate: day, clockIn: null, clockOut: null };
    const pairs = findAdjacentEntryPairs([a, broken]);
    expect(pairs).toHaveLength(0);
  });

  it("a single entry in a day produces no pairs", () => {
    const day = jstMidnight(2026, 8, 3);
    const pairs = findAdjacentEntryPairs([entry("a", day, 7, 17)]);
    expect(pairs).toHaveLength(0);
  });
});

describe("findNeighbors", () => {
  it("finds both prev and next for a middle entry", () => {
    const day = jstMidnight(2026, 8, 3);
    const a = entry("a", day, 7, 12);
    const b = entry("b", day, 12, 15);
    const c = entry("c", day, 15, 18);
    const result = findNeighbors([a, b, c], "b");
    expect(result.prev?.id).toBe("a");
    expect(result.next?.id).toBe("c");
  });

  it("returns null prev for the first entry of the day", () => {
    const day = jstMidnight(2026, 8, 3);
    const a = entry("a", day, 7, 12);
    const b = entry("b", day, 12, 15);
    const result = findNeighbors([a, b], "a");
    expect(result.prev).toBeNull();
    expect(result.next?.id).toBe("b");
  });

  it("returns null next for the last (still open) entry of the day", () => {
    const day = jstMidnight(2026, 8, 3);
    const a = entry("a", day, 7, 12);
    const b = entry("b", day, 12, null);
    const result = findNeighbors([a, b], "b");
    expect(result.prev?.id).toBe("a");
    expect(result.next).toBeNull();
  });

  it("returns nulls when the entry id is not found", () => {
    const day = jstMidnight(2026, 8, 3);
    const result = findNeighbors([entry("a", day, 7, 17)], "missing");
    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });
});
