import { describe, expect, it } from "vitest";
import { haversineDistanceKm, sortSitesByDistance } from "./geo";

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(35.6938, 139.7034, 35.6938, 139.7034)).toBeCloseTo(0, 6);
  });

  it("returns a plausible distance between Shinjuku and Shibuya (~3-4km)", () => {
    const d = haversineDistanceKm(35.6938, 139.7034, 35.658, 139.7016);
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(5);
  });
});

describe("sortSitesByDistance", () => {
  it("sorts sites nearest first", () => {
    const sites = [
      { id: "far", lat: 35.7295, lng: 139.7109 }, // 池袋
      { id: "near", lat: 35.658, lng: 139.7016 }, // 渋谷
    ];
    // 現在地を渋谷に近い座標にする
    const sorted = sortSitesByDistance(sites, 35.659, 139.702);
    expect(sorted[0].id).toBe("near");
    expect(sorted[0].distanceKm).toBeLessThan(sorted[1].distanceKm);
  });
});
