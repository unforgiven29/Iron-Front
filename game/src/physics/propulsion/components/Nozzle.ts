/**
 * Exhaust nozzle components (physics/propulsion).
 *
 * A nozzle turns the flow leaving the afterburner (mass flow, total pressure and temperature)
 * into gross thrust:  F = Cfg · [ w·V9 + (p9 − p0)·A9 ].  Momentum thrust plus PRESSURE thrust:
 * an under-expanded jet (p9 > p0) leaves thrust unused, an over-expanded one (p9 < p0) is pushed
 * back by the atmosphere. Only a nozzle that expands exactly to p0 gets the ideal thrust.
 *
 * Throat (A8): when the nozzle pressure ratio exceeds the critical value the throat is choked and
 * its area fixes how much flow can pass at that pressure, w = A8·pt·Γ(γ)/√(R·Tt). An engine
 * control normally sets A8 to whatever the engine's flow needs (holding the fan operating line);
 * if the throat cannot open far enough (e.g. held closed), the engine must slow down. That limit
 * is reported here and enforced by the engine control.
 *
 * Exit (A9): convergent–divergent nozzles expand supersonically to A9 = (A9/A8)·A8. The exit Mach
 * follows from the isentropic area–Mach relation. Flow separation in strongly over-expanded
 * nozzles (Summerfield criterion, p9 < 0.4·p0) is approximated as adapted expansion with the
 * thrust coefficient (approximation).
 */

export interface NozzleFlow {
  readonly massFlowKgS: number;
  readonly totalPressurePa: number;
  readonly totalTemperatureK: number;
  readonly gamma: number;
  readonly cpJkgK: number;
  readonly ambientPressurePa: number;
}

/** How the throat is commanded: follow the engine's flow ("auto") or held at a position (0 = closed, 1 = fully open). */
/** "auto": open to what the flow needs, but not below `minPosition` (e.g. a nozzle scheduled open at idle). */
export type ThroatCommand = { readonly kind: "auto"; readonly minPosition?: number } | { readonly kind: "position"; readonly position: number };

export interface NozzleResult {
  readonly grossThrustN: number;
  /** Momentum part w·V9 (× Cfg). */
  readonly momentumThrustN: number;
  /** Pressure part (p9 − p0)·A9 (× Cfg); negative when over-expanded. */
  readonly pressureThrustN: number;
  readonly throatAreaM2: number;
  readonly exitAreaM2: number;
  /** Throat area the flow needs at this pressure and temperature, m². */
  readonly requiredThroatAreaM2: number;
  /** Throat position 0 (closed / minimum area) .. 1 (fully open); NaN for nozzles without variable geometry. */
  readonly position: number;
  readonly exitPressurePa: number;
  readonly exitMach: number;
  readonly choked: boolean;
  /** required / available throat area at the commanded position (> 1: the throat is too small for the flow). */
  readonly throatAreaRatio: number;
}

export interface NozzleModel {
  readonly kind: string;
  evaluate(flow: NozzleFlow, command: ThroatCommand): NozzleResult;
}

const gasR = (cp: number, g: number) => (cp * (g - 1)) / g;
const criticalPressureRatio = (g: number) => ((g + 1) / 2) ** (g / (g - 1));
/** Γ(γ) in w = A·pt·Γ/√(R·Tt) for a choked throat. */
const chokedFlowParameter = (g: number) => Math.sqrt(g) * (2 / (g + 1)) ** ((g + 1) / (2 * (g - 1)));

/** Choked throat area for a flow, m² (valid at supercritical pressure ratio). */
export function chokedThroatArea(flow: NozzleFlow): number {
  const R = gasR(flow.cpJkgK, flow.gamma);
  return (flow.massFlowKgS * Math.sqrt(R * flow.totalTemperatureK)) / (flow.totalPressurePa * chokedFlowParameter(flow.gamma));
}

/**
 * Throat area the flow needs: choked value when the pressure ratio is supercritical, otherwise
 * the subsonic area that passes the flow with the throat at ambient pressure (w = ρ·V·A).
 */
export function requiredThroatArea(flow: NozzleFlow): number {
  const g = flow.gamma;
  if (flow.totalPressurePa / flow.ambientPressurePa >= criticalPressureRatio(g)) return chokedThroatArea(flow);
  const R = gasR(flow.cpJkgK, g);
  const t = flow.totalTemperatureK * (flow.ambientPressurePa / flow.totalPressurePa) ** ((g - 1) / g);
  const v = Math.max(1, idealVelocity(flow, flow.ambientPressurePa));
  return flow.massFlowKgS / ((flow.ambientPressurePa / (R * t)) * v);
}

/** Supersonic exit Mach for an area ratio A/A* (isentropic). */
export function supersonicMachForAreaRatio(areaRatio: number, g: number): number {
  const f = (m: number) => (1 / m) * ((2 / (g + 1)) * (1 + ((g - 1) / 2) * m * m)) ** ((g + 1) / (2 * (g - 1)));
  if (areaRatio <= 1) return 1;
  let lo = 1, hi = 8;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < areaRatio) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Jet velocity for ideal expansion from total conditions to a static pressure. */
function idealVelocity(flow: NozzleFlow, staticPressurePa: number): number {
  const pr = Math.max(1, flow.totalPressurePa / staticPressurePa);
  return Math.sqrt(2 * flow.cpJkgK * flow.totalTemperatureK * (1 - pr ** (-(flow.gamma - 1) / flow.gamma)));
}

/** Always perfectly expanded to ambient (the simplest model; no geometry). */
export function idealNozzle(thrustCoefficient: number): NozzleModel {
  return {
    kind: "ideal",
    evaluate: (flow) => {
      const required = requiredThroatArea(flow);
      const momentum = thrustCoefficient * flow.massFlowKgS * idealVelocity(flow, flow.ambientPressurePa);
      return { grossThrustN: momentum, momentumThrustN: momentum, pressureThrustN: 0, throatAreaM2: required, exitAreaM2: Number.NaN, requiredThroatAreaM2: required, position: Number.NaN, exitPressurePa: flow.ambientPressurePa, exitMach: Number.NaN, choked: flow.totalPressurePa / flow.ambientPressurePa > criticalPressureRatio(flow.gamma), throatAreaRatio: 1 };
    }
  };
}

import { lookup1D, type Table1D } from "../../aerodynamics/Tables.js";

export interface VariableCdNozzleSpec {
  /** Throat area at the closed (minimum) and fully open positions, m². */
  readonly minThroatAreaM2: number;
  readonly maxThroatAreaM2: number;
  /** Exit/throat area ratio A9/A8 at the closed and open positions (mechanically linked; linear between). */
  readonly exitAreaRatioClosed: number;
  readonly exitAreaRatioOpen: number;
  /** Gross thrust coefficient Cfg (friction, divergence, leakage). */
  readonly thrustCoefficient: number;
  /** Optional: exit/throat area ratio as a function of nozzle pressure ratio pt/p0 (replaces the linked closed/open ratios). */
  readonly exitAreaRatioByPressureRatio?: Table1D;
  /** Optional: thrust coefficient as a function of nozzle pressure ratio (replaces the constant). */
  readonly thrustCoefficientByPressureRatio?: Table1D;
}

/** Variable-area convergent–divergent nozzle with linked exit area (e.g. afterburning fighter engines). */
export function variableConvergentDivergentNozzle(spec: VariableCdNozzleSpec): NozzleModel {
  const { minThroatAreaM2: aMin, maxThroatAreaM2: aMax } = spec;
  return {
    kind: "variable-convergent-divergent",
    evaluate: (flow, command) => {
      const g = flow.gamma, p0 = flow.ambientPressurePa, pt = flow.totalPressurePa;
      const required = requiredThroatArea(flow);
      const a8 = command.kind === "auto" ? Math.min(aMax, Math.max(aMin + (aMax - aMin) * Math.min(1, Math.max(0, command.minPosition ?? 0)), required)) : aMin + (aMax - aMin) * Math.min(1, Math.max(0, command.position));
      const position = (a8 - aMin) / (aMax - aMin);
      const npr = pt / p0;
      const ratio = spec.exitAreaRatioByPressureRatio ? lookup1D(spec.exitAreaRatioByPressureRatio, npr).value : spec.exitAreaRatioClosed + (spec.exitAreaRatioOpen - spec.exitAreaRatioClosed) * position;
      const cfg = spec.thrustCoefficientByPressureRatio ? lookup1D(spec.thrustCoefficientByPressureRatio, npr).value : spec.thrustCoefficient;
      const a9 = a8 * ratio;
      const choked = pt / p0 > criticalPressureRatio(g);
      const R = gasR(flow.cpJkgK, g);
      let v9: number, p9: number, m9: number, pressure = 0;
      if (!choked) {
        // Subsonic throughout: expands to ambient pressure.
        v9 = idealVelocity(flow, p0); p9 = p0; m9 = v9 / Math.sqrt(g * R * flow.totalTemperatureK);
      } else {
        m9 = supersonicMachForAreaRatio(ratio, g);
        const tr = 1 + ((g - 1) / 2) * m9 * m9;
        p9 = pt / tr ** (g / (g - 1));
        const t9 = flow.totalTemperatureK / tr;
        if (p9 < 0.4 * p0) {
          // Strongly over-expanded: the jet separates and adapts (approximation).
          v9 = idealVelocity(flow, p0); p9 = p0; m9 = Number.NaN;
        } else {
          v9 = m9 * Math.sqrt(g * R * t9);
          pressure = (p9 - p0) * a9;
        }
      }
      const momentumThrustN = cfg * flow.massFlowKgS * v9;
      const pressureThrustN = cfg * pressure;
      return {
        grossThrustN: momentumThrustN + pressureThrustN, momentumThrustN, pressureThrustN,
        throatAreaM2: a8, exitAreaM2: a9, requiredThroatAreaM2: required, position, exitPressurePa: p9, exitMach: m9, choked,
        throatAreaRatio: required / a8
      };
    }
  };
}
