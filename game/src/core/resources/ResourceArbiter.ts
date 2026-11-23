/**
 * Shared resource arbitration: offers vs demands -> grants, per network, per tick.
 *
 * Owner: game/core/resources. This decides who gets how much of a scarce quantity.
 * It does not own network physics: voltage dynamics, pressure decay, fuel feed and
 * so on stay in game/systems, which turn their physical state into offers.
 *
 * Policy (deterministic, independent of input order):
 * 1. Each network's usable capacity is the sum of its valid, unexpired offers.
 * 2. Minimum grants go out in priority order (lower number first, then consumer id).
 *    A consumer whose minimum doesn't fit is denied outright. It never gets a partial minimum.
 * 3. Remaining capacity tops consumers up toward their desired amount in priority order.
 *    Consumers sharing a priority split the remainder in proportion to their outstanding need.
 * 4. Grants are drawn from offers in provider-id order, so each grant can name its sources.
 * Total grants never exceed total valid capacity (conservation).
 *
 * Not implemented: quality-of-supply matching, reservations held across ticks and
 * starvation-avoidance aging. Each is an explicit future slice, not a silent assumption.
 */

export interface ResourceNetwork {
  readonly networkId: string;
  /** Typed family; families are never pooled with each other. */
  readonly resourceType: "electrical-power" | "hydraulic-flow" | "fuel-flow" | "coolant-capacity" | "oxygen-flow" | "data-bandwidth";
  /** Unit every offer and demand on this network must use, e.g. "W", "L/s", "kg/s". */
  readonly unit: string;
}

export interface ResourceOffer {
  readonly providerId: string;
  readonly networkId: string;
  readonly unit: string;
  readonly capacity: number;
  /** Inclusive validity interval in ticks. An offer outside it is stale and excluded. */
  readonly validFromTick: number;
  readonly validUntilTick: number;
}

export interface ResourceDemand {
  readonly consumerId: string;
  readonly networkId: string;
  readonly unit: string;
  /** Lower number is served first. Integer. */
  readonly priority: number;
  /** Smallest grant the consumer can use at all. Below this it gets nothing. */
  readonly minimum: number;
  readonly desired: number;
}

export type GrantStatus = "full" | "partial" | "denied";

export interface ResourceGrant {
  readonly consumerId: string;
  readonly networkId: string;
  readonly unit: string;
  readonly granted: number;
  readonly unmet: number;
  readonly status: GrantStatus;
  readonly reason: string;
  /** Amount drawn from each provider, in provider-id order. */
  readonly sources: readonly { readonly providerId: string; readonly amount: number }[];
}

export interface NetworkSummary {
  readonly networkId: string;
  readonly unit: string;
  readonly capacity: number;
  readonly granted: number;
  readonly spare: number;
  readonly excludedOffers: readonly { readonly providerId: string; readonly reason: string }[];
}

export interface AllocationResult {
  readonly tick: number;
  readonly grants: readonly ResourceGrant[];
  readonly networks: readonly NetworkSummary[];
}

export interface AllocationRequest {
  readonly tick: number;
  readonly networks: readonly ResourceNetwork[];
  readonly offers: readonly ResourceOffer[];
  readonly demands: readonly ResourceDemand[];
}

/** Absorbs floating-point dust in comparisons only. It is never used as a quantity. */
const EPS = 1e-9;
const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class ResourceRequestError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid resource allocation request:\n${problems.join("\n")}`);
    this.name = "ResourceRequestError";
  }
}

function validate(request: AllocationRequest): void {
  const problems: string[] = [];
  const amount = (v: number, what: string): void => {
    if (!Number.isFinite(v) || v < 0) problems.push(`${what} must be a finite, non-negative number (got ${v}).`);
  };
  if (!Number.isSafeInteger(request.tick) || request.tick < 0) problems.push(`tick must be a non-negative integer (got ${request.tick}).`);
  const networks = new Map<string, ResourceNetwork>();
  for (const n of request.networks) {
    if (networks.has(n.networkId)) problems.push(`Duplicate network "${n.networkId}".`);
    if (n.unit.trim() === "") problems.push(`Network "${n.networkId}" needs a unit.`);
    networks.set(n.networkId, n);
  }
  const checkNetwork = (who: string, networkId: string, unit: string): void => {
    const n = networks.get(networkId);
    if (!n) problems.push(`${who} references unknown network "${networkId}".`);
    else if (n.unit !== unit) problems.push(`${who} uses unit "${unit}" but network "${networkId}" uses "${n.unit}".`);
  };
  const providers = new Set<string>();
  for (const o of request.offers) {
    const key = `${o.networkId}/${o.providerId}`;
    if (providers.has(key)) problems.push(`Duplicate offer from "${o.providerId}" on "${o.networkId}".`);
    providers.add(key);
    checkNetwork(`Offer "${o.providerId}"`, o.networkId, o.unit);
    amount(o.capacity, `Offer "${o.providerId}" capacity`);
    if (!Number.isSafeInteger(o.validFromTick) || !Number.isSafeInteger(o.validUntilTick) || o.validUntilTick < o.validFromTick) {
      problems.push(`Offer "${o.providerId}" has an invalid validity interval [${o.validFromTick}, ${o.validUntilTick}].`);
    }
  }
  const consumers = new Set<string>();
  for (const d of request.demands) {
    const key = `${d.networkId}/${d.consumerId}`;
    if (consumers.has(key)) problems.push(`Duplicate demand from "${d.consumerId}" on "${d.networkId}".`);
    consumers.add(key);
    checkNetwork(`Demand "${d.consumerId}"`, d.networkId, d.unit);
    amount(d.minimum, `Demand "${d.consumerId}" minimum`);
    amount(d.desired, `Demand "${d.consumerId}" desired`);
    if (d.minimum > d.desired) problems.push(`Demand "${d.consumerId}" minimum ${d.minimum} exceeds desired ${d.desired}.`);
    if (!Number.isSafeInteger(d.priority)) problems.push(`Demand "${d.consumerId}" priority must be an integer.`);
  }
  if (problems.length > 0) throw new ResourceRequestError(problems);
}

export function allocateResources(request: AllocationRequest): AllocationResult {
  validate(request);
  const grants: ResourceGrant[] = [];
  const summaries: NetworkSummary[] = [];

  for (const network of [...request.networks].sort((a, b) => byString(a.networkId, b.networkId))) {
    const excludedOffers: { providerId: string; reason: string }[] = [];
    const pool: { providerId: string; remaining: number }[] = [];
    for (const o of request.offers.filter((x) => x.networkId === network.networkId).sort((a, b) => byString(a.providerId, b.providerId))) {
      if (request.tick < o.validFromTick) excludedOffers.push({ providerId: o.providerId, reason: `not valid until tick ${o.validFromTick}` });
      else if (request.tick > o.validUntilTick) excludedOffers.push({ providerId: o.providerId, reason: `stale: expired after tick ${o.validUntilTick}` });
      else if (o.capacity > 0) pool.push({ providerId: o.providerId, remaining: o.capacity });
    }
    const capacity = pool.reduce((s, p) => s + p.remaining, 0);
    let available = capacity;

    const demands = request.demands
      .filter((d) => d.networkId === network.networkId)
      .sort((a, b) => a.priority - b.priority || byString(a.consumerId, b.consumerId));
    const granted = new Map<string, number>(demands.map((d) => [d.consumerId, 0]));
    const denied = new Set<string>();

    // Pass 1: minimums, all-or-nothing, strict priority order.
    for (const d of demands) {
      if (d.minimum <= available + EPS) {
        const g = Math.min(d.minimum, available);
        granted.set(d.consumerId, g);
        available -= g;
      } else {
        denied.add(d.consumerId);
      }
    }

    // Pass 2: top up toward desired, priority groups in order, proportional within a group.
    const priorities = [...new Set(demands.map((d) => d.priority))].sort((a, b) => a - b);
    for (const priority of priorities) {
      if (available <= EPS) break;
      const group = demands.filter((d) => d.priority === priority && !denied.has(d.consumerId));
      const need = (d: ResourceDemand): number => d.desired - (granted.get(d.consumerId) as number);
      const totalNeed = group.reduce((s, d) => s + need(d), 0);
      if (totalNeed <= EPS) continue;
      const share = Math.min(1, available / totalNeed);
      let given = 0;
      for (const d of group) {
        const extra = need(d) * share;
        granted.set(d.consumerId, (granted.get(d.consumerId) as number) + extra);
        given += extra;
      }
      available = Math.max(0, available - given);
    }

    // Attribute each grant to providers, in consumer service order.
    let providerIndex = 0;
    let totalGranted = 0;
    for (const d of demands) {
      let remaining = granted.get(d.consumerId) as number;
      totalGranted += remaining;
      const sources: { providerId: string; amount: number }[] = [];
      while (remaining > EPS && providerIndex < pool.length) {
        const p = pool[providerIndex] as { providerId: string; remaining: number };
        const take = Math.min(p.remaining, remaining);
        if (take > 0) sources.push({ providerId: p.providerId, amount: take });
        p.remaining -= take;
        remaining -= take;
        if (p.remaining <= EPS) providerIndex++;
      }
      const g = granted.get(d.consumerId) as number;
      const unmet = Math.max(0, d.desired - g);
      let status: GrantStatus;
      let reason: string;
      if (denied.has(d.consumerId)) {
        status = "denied";
        reason = capacity <= EPS
          ? "no valid supply on network"
          : `minimum ${d.minimum} ${network.unit} not available after higher-priority demand`;
      } else if (unmet <= EPS) {
        status = "full";
        reason = "desired amount granted";
      } else {
        status = "partial";
        reason = `capacity exhausted: ${unmet.toFixed(6).replace(/\.?0+$/, "")} ${network.unit} unmet`;
      }
      grants.push({ consumerId: d.consumerId, networkId: network.networkId, unit: network.unit, granted: g, unmet: status === "full" ? 0 : unmet, status, reason, sources });
    }
    summaries.push({ networkId: network.networkId, unit: network.unit, capacity, granted: totalGranted, spare: Math.max(0, capacity - totalGranted), excludedOffers });
  }

  grants.sort((a, b) => byString(a.networkId, b.networkId) || byString(a.consumerId, b.consumerId));
  return { tick: request.tick, grants, networks: summaries };
}
