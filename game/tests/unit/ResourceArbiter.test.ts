import { describe, expect, it } from "vitest";
import {
  allocateResources, ResourceRequestError,
  type AllocationRequest, type ResourceDemand, type ResourceNetwork, type ResourceOffer
} from "../../src/core/resources/ResourceArbiter.js";

const BUS: ResourceNetwork = { networkId: "test.dc-bus", resourceType: "electrical-power", unit: "W" };
const HYD: ResourceNetwork = { networkId: "test.hyd-a", resourceType: "hydraulic-flow", unit: "L/s" };
const offer = (providerId: string, capacity: number, extra: Partial<ResourceOffer> = {}): ResourceOffer =>
  ({ providerId, networkId: BUS.networkId, unit: "W", capacity, validFromTick: 0, validUntilTick: 1000, ...extra });
const demand = (consumerId: string, priority: number, minimum: number, desired: number, extra: Partial<ResourceDemand> = {}): ResourceDemand =>
  ({ consumerId, networkId: BUS.networkId, unit: "W", priority, minimum, desired, ...extra });
const run = (offers: ResourceOffer[], demands: ResourceDemand[], tick = 10, networks = [BUS, HYD]) =>
  allocateResources({ tick, networks, offers, demands });
const grant = (r: ReturnType<typeof run>, id: string) => r.grants.find((g) => g.consumerId === id);

describe("allocateResources", () => {
  it("grants everything when supply exceeds demand and reports spare capacity", () => {
    const r = run([offer("gen", 1000)], [demand("a", 0, 100, 300), demand("b", 1, 50, 200)]);
    expect(grant(r, "a")).toMatchObject({ granted: 300, unmet: 0, status: "full", sources: [{ providerId: "gen", amount: 300 }] });
    expect(grant(r, "b")).toMatchObject({ granted: 200, status: "full" });
    expect(r.networks.find((n) => n.networkId === BUS.networkId)).toMatchObject({ capacity: 1000, granted: 500, spare: 500 });
  });

  it("serves minimums by priority and denies a minimum that does not fit, never granting part of a minimum", () => {
    const r = run([offer("gen", 250)], [demand("flight-control", 0, 200, 200), demand("radar", 1, 100, 400), demand("lights", 2, 10, 20)]);
    expect(grant(r, "flight-control")).toMatchObject({ granted: 200, status: "full" });
    expect(grant(r, "radar")).toMatchObject({ granted: 0, unmet: 400, status: "denied", reason: "minimum 100 W not available after higher-priority demand" });
    expect(grant(r, "lights")).toMatchObject({ granted: 20, status: "full" });
  });

  it("splits remaining capacity proportionally within a priority after minimums", () => {
    const r = run([offer("gen", 400)], [demand("a", 1, 100, 300), demand("b", 1, 100, 200)]);
    // After minimums: 200 spare; outstanding need a=200, b=100 -> share 2/3.
    expect(grant(r, "a")?.granted).toBeCloseTo(100 + 200 * (2 / 3), 9);
    expect(grant(r, "b")?.granted).toBeCloseTo(100 + 100 * (2 / 3), 9);
    expect(grant(r, "a")?.status).toBe("partial");
    expect(grant(r, "a")?.reason).toContain("W unmet");
  });

  it("conserves capacity across many random-looking demands", () => {
    const demands = Array.from({ length: 25 }, (_, i) => demand(`c${i}`, i % 4, (i * 7) % 13, ((i * 7) % 13) + (i * 11) % 17));
    const offers = [offer("g1", 61.5), offer("g2", 40.25), offer("g3", 13)];
    const r = run(offers, demands);
    const total = r.grants.reduce((s, g) => s + g.granted, 0);
    const sourced = r.grants.flatMap((g) => g.sources).reduce((s, x) => s + x.amount, 0);
    expect(total).toBeLessThanOrEqual(114.75 + 1e-9);
    expect(sourced).toBeCloseTo(total, 9);
    for (const g of r.grants) expect(g.granted).toBeGreaterThanOrEqual(0);
  });

  it("is independent of input order", () => {
    const offers = [offer("b-gen", 100), offer("a-gen", 50)];
    const demands = [demand("z", 1, 10, 80), demand("y", 0, 20, 60), demand("x", 1, 10, 40)];
    const r1 = run(offers, demands);
    const r2 = run([...offers].reverse(), [...demands].reverse());
    expect(r2).toEqual(r1);
    expect(grant(r1, "y")?.sources).toEqual([{ providerId: "a-gen", amount: 50 }, { providerId: "b-gen", amount: 10 }]);
  });

  it("excludes stale and not-yet-valid offers and explains why", () => {
    const r = run([offer("old", 500, { validUntilTick: 9 }), offer("future", 500, { validFromTick: 11 }), offer("ok", 30)], [demand("a", 0, 0, 100)]);
    expect(grant(r, "a")).toMatchObject({ granted: 30, status: "partial" });
    expect(r.networks[0]?.excludedOffers).toEqual([
      { providerId: "future", reason: "not valid until tick 11" },
      { providerId: "old", reason: "stale: expired after tick 9" }
    ]);
  });

  it("reports provider loss and recovery across ticks", () => {
    const demands = [demand("radar", 0, 100, 100)];
    expect(grant(run([offer("gen", 200)], demands, 1), "radar")?.status).toBe("full");
    expect(grant(run([], demands, 2), "radar")).toMatchObject({ status: "denied", reason: "no valid supply on network" });
    expect(grant(run([offer("gen", 200)], demands, 3), "radar")?.status).toBe("full");
  });

  it("isolates networks: a shortage on one never draws from another", () => {
    const r = run(
      [offer("gen", 10), { providerId: "pump", networkId: HYD.networkId, unit: "L/s", capacity: 500, validFromTick: 0, validUntilTick: 100 }],
      [demand("radar", 0, 50, 50), { consumerId: "actuator", networkId: HYD.networkId, unit: "L/s", priority: 0, minimum: 1, desired: 5 }]
    );
    expect(grant(r, "radar")?.status).toBe("denied");
    expect(grant(r, "actuator")).toMatchObject({ granted: 5, sources: [{ providerId: "pump", amount: 5 }] });
  });

  it("rejects invalid requests with every problem listed", () => {
    const bad: AllocationRequest = {
      tick: -1,
      networks: [BUS, BUS],
      offers: [offer("gen", -5), offer("gen", 5), offer("x", 1, { unit: "kW" }), offer("y", 1, { networkId: "nope" }), offer("z", 1, { validFromTick: 5, validUntilTick: 4 })],
      demands: [demand("a", 0, 10, 5), demand("b", 0.5, 0, 1), demand("c", 0, Number.NaN, 1)]
    };
    try {
      allocateResources(bad);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ResourceRequestError);
      const problems = (e as ResourceRequestError).problems.join("\n");
      for (const fragment of ["tick must be", 'Duplicate network "test.dc-bus"', "capacity must be", 'Duplicate offer from "gen"', 'uses unit "kW"', 'unknown network "nope"', "invalid validity interval", "exceeds desired", "priority must be an integer", "minimum must be"]) {
        expect(problems).toContain(fragment);
      }
    }
  });
});
