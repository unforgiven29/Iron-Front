import { describe, expect, it } from "vitest";
import { ControlRegistry } from "../../src/core/controls/ControlRegistry.js";

const def = { id: "test.mode", ownerId: "test.owner", label: "MODE", positions: ["A", "B", "C"], defaultPosition: "A", provenance: "test" };

describe("ControlRegistry", () => {
  it("changes position only when the owner accepts, and records every request", () => {
    const r = new ControlRegistry();
    r.defineSwitch(def, ({ to }) => (to === "C" ? { accepted: false, reason: "interlocked" } : { accepted: true }));
    expect(r.position("test.mode")).toBe("A");
    expect(r.request("test.mode", "B", "ui")).toMatchObject({ accepted: true, from: "A", to: "B" });
    expect(r.request("test.mode", "C", "key")).toMatchObject({ accepted: false, reason: "interlocked" });
    expect(r.position("test.mode")).toBe("B");
    expect(r.request("test.mode", "Z", "ui")).toMatchObject({ accepted: false });
    expect(r.changes().map((c) => `${c.to}:${c.accepted}`)).toEqual(["B:true", "C:false", "Z:false"]);
    expect(r.snapshot()).toEqual({ "test.mode": "B" });
  });

  it("cycles through positions and reports owner faults as rejections", () => {
    const r = new ControlRegistry();
    r.defineSwitch(def, () => ({ accepted: true }));
    r.cycle("test.mode", "k"); r.cycle("test.mode", "k"); r.cycle("test.mode", "k");
    expect(r.position("test.mode")).toBe("A");
    r.defineSwitch({ ...def, id: "test.broken" }, () => { throw new Error("boom"); });
    expect(r.request("test.broken", "B", "k")).toMatchObject({ accepted: false, reason: "owner fault: boom" });
  });

  it("validates definitions", () => {
    const r = new ControlRegistry();
    expect(() => r.defineSwitch({ ...def, id: "Bad Id" }, () => ({ accepted: true }))).toThrow("stable");
    expect(() => r.defineSwitch({ ...def, positions: ["A"] }, () => ({ accepted: true }))).toThrow("two distinct");
    expect(() => r.defineSwitch({ ...def, defaultPosition: "Q" }, () => ({ accepted: true }))).toThrow("not a position");
    r.defineSwitch(def, () => ({ accepted: true }));
    expect(() => r.defineSwitch(def, () => ({ accepted: true }))).toThrow("already defined");
    expect(() => r.request("nope", "A", "k")).toThrow("Unknown switch");
  });
});
