/**
 * Contract for an aircraft package's avionics / weapon-control suite (owner: platforms/aircraft/common).
 *
 * The shared session steps the suite at a fixed rate with the ownship navigation state and the
 * world's SensorScene (never target truth), forwards the package's own key bindings, and draws the
 * display lists it returns on the HUD and on named cockpit screens. All mode logic, controls and
 * symbology live in the package; the shared sensor equipment lives in game/src/sensors.
 */
import type { SensorScene } from "../../../physics/sensing/SensorScene.js";
import type { DisplayList } from "../../../rendering/instruments/DisplayList.js";
import type { SensorOwnship } from "../../../sensors/common/ScanGeometry.js";
import type { AircraftSnapshot } from "./FixedWingAircraft.js";

export interface AvionicsContext {
  readonly own: SensorOwnship;
  readonly snapshot: AircraftSnapshot;
  readonly scene: SensorScene;
  /** Pilot's head direction relative to the aircraft body (helmet sight), rad. */
  readonly head: { readonly az: number; readonly el: number };
  /** Weapon release and in-flight weapon status (absent where no world supports weapons). */
  readonly weapons?: WeaponPort;
}

/** The world's side of weapon release: the avionics launch; the world flies the missile. */
export interface WeaponPort {
  launch(spec: import("../../../weapons/missiles/Missile.js").MissileSpec, positionEnuM: import("../../../core/coordinates/CoordinateFrames.js").Vector3, velocityEnuMps: import("../../../core/coordinates/CoordinateFrames.js").Vector3, link: () => import("../../../weapons/missiles/Missile.js").LauncherLink, irCue: import("../../../core/coordinates/CoordinateFrames.js").Vector3 | null): string;
  events(sinceS?: number): readonly import("../../../world/weapons/MissileWorld.js").WeaponEvent[];
  /**
   * Launch a NOTIONAL low-fidelity missile (placeholder weapons; see weapons/catalog/NotionalAirToAir).
   * `cue` is the launcher's own target estimate (radar lock), or null when it has none.
   */
  launchNotional?(spec: import("../../../weapons/catalog/NotionalAirToAir.js").NotionalMissileSpec, positionEnuM: import("../../../core/coordinates/CoordinateFrames.js").Vector3, velocityEnuMps: import("../../../core/coordinates/CoordinateFrames.js").Vector3, cue: import("../../../world/weapons/NotionalMissiles.js").LauncherCue): string;
  notionalEvents?(sinceS?: number): readonly import("../../../world/weapons/NotionalMissiles.js").NotionalWeaponEvent[];
}

/** A selectable stores configuration offered by an aircraft package (menu loadout screen). */
export interface LoadoutOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Per-station store names, outboard-left to outboard-right ("" = empty station). */
  readonly stations: readonly string[];
}

export interface AvionicsControl {
  /** KeyboardEvent.key, lower case. */
  readonly key: string;
  readonly label: string;
  /** Cockpit control this models, with provenance. */
  readonly control: string;
}

export interface AvionicsSuite {
  readonly controls: readonly AvionicsControl[];
  /** Key pressed (down = true) or released. Returns true when the suite used the key. */
  key(key: string, down: boolean): boolean;
  step(ctx: AvionicsContext, dt: number): void;
  /** HUD symbology for the current state. */
  hud(): DisplayList;
  /** True when `hud()` is the aircraft's complete HUD (its own flight symbology, units and layout). */
  readonly ownsHud?: boolean;
  /** Helmet-mounted sight symbology at the pilot's line of sight (angle frame, circle radii in degrees). */
  helmet?(): DisplayList;
  /** Content for a named cockpit screen, or undefined when the suite does not drive it. */
  screen(id: string): DisplayList | undefined;
  /** Short status lines for data panels and tests. */
  status(): Readonly<Record<string, string | number>>;
  reset(): void;
  /** Optional presentation settings from the game menu (e.g. hudLanguage = ru | en). */
  setOption?(key: string, value: string): void;
}

export const AVIONICS_RATE_HZ = 50;
