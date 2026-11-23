import { describe, expect, it } from "vitest";
import { compareVersions, parseRange, parseVersion, satisfies } from "../../src/core/modules/SemanticVersion.js";

const v = (text: string) => {
  const parsed = parseVersion(text);
  if (!parsed) throw new Error(`bad test version ${text}`);
  return parsed;
};
const sat = (version: string, range: string) => {
  const parsed = parseRange(range);
  if (!parsed) throw new Error(`bad test range ${range}`);
  return satisfies(v(version), parsed);
};

describe("SemanticVersion", () => {
  it("rejects malformed versions and ranges", () => {
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("01.2.3")).toBeNull();
    expect(parseRange("")).toBeNull();
    expect(parseRange("^1.x")).toBeNull();
    expect(parseRange("latest")).toBeNull();
  });

  it("orders by precedence including prereleases", () => {
    expect(compareVersions(v("1.0.0-alpha"), v("1.0.0"))).toBe(-1);
    expect(compareVersions(v("1.0.0-alpha.2"), v("1.0.0-alpha.10"))).toBe(-1);
    expect(compareVersions(v("1.0.0-1"), v("1.0.0-alpha"))).toBe(-1);
    expect(compareVersions(v("2.0.0"), v("1.9.9"))).toBe(1);
    expect(compareVersions(v("1.2.3+build"), v("1.2.3"))).toBe(0);
  });

  it("applies caret boundaries for major, zero-major and zero-minor versions", () => {
    expect(sat("1.9.0", "^1.2.3")).toBe(true);
    expect(sat("2.0.0", "^1.2.3")).toBe(false);
    expect(sat("1.2.2", "^1.2.3")).toBe(false);
    expect(sat("0.1.9", "^0.1.0")).toBe(true);
    expect(sat("0.2.0", "^0.1.0")).toBe(false);
    expect(sat("0.0.3", "^0.0.3")).toBe(true);
    expect(sat("0.0.4", "^0.0.3")).toBe(false);
  });

  it("applies tilde, comparator sets, exact and wildcard", () => {
    expect(sat("1.2.9", "~1.2.0")).toBe(true);
    expect(sat("1.3.0", "~1.2.0")).toBe(false);
    expect(sat("1.5.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(sat("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
    expect(sat("1.0.0", "1.0.0")).toBe(true);
    expect(sat("1.0.1", "1.0.0")).toBe(false);
    expect(sat("9.9.9", "*")).toBe(true);
  });

  it("never admits a prerelease unless the range names that release's prerelease", () => {
    expect(sat("1.3.0-beta", "^1.2.0")).toBe(false);
    expect(sat("1.3.0-beta", "*")).toBe(false);
    expect(sat("1.2.0-beta.2", "^1.2.0-beta.1")).toBe(true);
  });
});
