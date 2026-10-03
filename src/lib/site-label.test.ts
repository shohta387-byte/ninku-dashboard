import { describe, expect, it } from "vitest";
import { siteLabel } from "./site-label";

describe("siteLabel", () => {
  it("appends the contractor name when set", () => {
    expect(siteLabel({ name: "○○ビル新築", contractor: { name: "A建設" } })).toBe("○○ビル新築（A建設）");
  });

  it("shows only the site name when the contractor is not set", () => {
    expect(siteLabel({ name: "○○ビル新築", contractor: null })).toBe("○○ビル新築");
    expect(siteLabel({ name: "○○ビル新築" })).toBe("○○ビル新築");
  });
});
