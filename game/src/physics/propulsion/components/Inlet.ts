/**
 * Engine inlet components (physics/propulsion). An inlet returns the total-pressure recovery
 * pt2/pt0 for a flight Mach number. Engine packages pick the inlet their airframe actually has.
 */

export interface InletCondition {
  readonly weightOnWheels: boolean;
  /** Equivalent (≈ indicated) airspeed, m/s. */
  readonly equivalentAirspeedMps: number;
  /** Package intake state (variable ramps / auxiliary doors), when the airframe has one. */
  readonly state?: InletState;
}

/** Live state of a variable intake, produced by the aircraft package's own intake model. */
export interface InletState {
  /** Forward-ramp extension 0 (duct fully open) … 1 (fully extended / duct closed). */
  readonly rampExtension: number;
  /** Extension the ramp schedule currently asks for. */
  readonly rampScheduled: number;
  /** Auxiliary (blow-in / louver) doors open. */
  readonly auxOpen: boolean;
  /** Operating mode label for displays, e.g. "FOD" / "FLIGHT" / "SCHED 2". */
  readonly mode: string;
  /** Engine-face flow distortion index 0 (clean) … 1 (severe), for surge margin. */
  readonly distortion: number;
}

export interface InletModel {
  readonly kind: string;
  /** Total-pressure recovery pt2/pt0 at a freestream Mach number (and optional airframe condition). */
  recovery(mach: number, condition?: InletCondition): number;
}

/** Total-pressure ratio across a normal shock (γ = 1.4), exact. 1 at or below Mach 1. */
export function normalShockRecovery(mach: number): number {
  if (mach <= 1) return 1;
  const g = 1.4, m2 = mach * mach;
  return ((g + 1) * m2 / ((g - 1) * m2 + 2)) ** (g / (g - 1)) * ((g + 1) / (2 * g * m2 - (g - 1))) ** (1 / (g - 1));
}

/** MIL-E-5008B reference recovery for an efficient supersonic inlet. */
export function milE5008bRecovery(mach: number): number {
  return mach <= 1 ? 1 : 1 - 0.075 * (mach - 1) ** 1.35;
}

/** Fixed pitot inlet (e.g. F-16): a normal shock stands at the lip above Mach 1. */
export function pitotInlet(subsonicRecovery = 1): InletModel {
  return { kind: "pitot-normal-shock", recovery: (m) => subsonicRecovery * normalShockRecovery(m) };
}

/** Generic efficient supersonic (ramp/cone) inlet per MIL-E-5008B. */
export function milE5008bInlet(): InletModel {
  return { kind: "mil-e-5008b", recovery: milE5008bRecovery };
}
