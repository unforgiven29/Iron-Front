/**
 * One flying session for any aircraft definition: shared FixedWingAircraft runtime, terrain,
 * Three.js cockpit view, keyboard input and the frame loop. Nothing here is aircraft-specific:
 * cockpit, MFD pages, switch keys and data notes come from the AircraftDefinition.
 */
import { mountDataPanel } from "./DataPanel.js";
import { WarningTones } from "./WarningTones.js";
import { runwayLineUp } from "../world/infrastructure/Airfield.js";
import { createTestRange, hostileSpecs, targetsFor, type TargetScenario } from "./TestRange.js";
import { HostileFighter, type HostileEnvironment } from "../world/combat/HostileFighters.js";
import { NotionalMissileWorld, type CombatTarget } from "../world/weapons/NotionalMissiles.js";
import type { WeaponPort } from "../platforms/aircraft/common/Avionics.js";
import { AirTargetWorld } from "../world/targets/AirTargets.js";
import { MissileWorld } from "../world/weapons/MissileWorld.js";
import { AVIONICS_RATE_HZ } from "../platforms/aircraft/common/Avionics.js";
import { layeredWind } from "../physics/environment/Atmosphere.js";
import type { AircraftDefinition } from "../platforms/aircraft/common/AircraftDefinition.js";
import { FixedWingAircraft, type AircraftSnapshot } from "../platforms/aircraft/common/FixedWingAircraft.js";
import type { CockpitViewSource, HudData, MfdPage } from "../rendering/three/ThreeCockpitView.js";

const DEG = 180 / Math.PI;
const KT = 1.943844;
const FT = 3.28084;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export interface AircraftSessionHandle {
  readonly paused: boolean;
  setPaused(paused: boolean): void;
  restart(): void;
  dispose(): void;
}

export interface MissionResult {
  readonly outcome: "victory" | "shot-down" | "crashed";
  readonly kills: number;
  readonly hostiles: number;
  readonly timeS: number;
  readonly shotsFired: number;
  readonly cause?: string;
}

export interface SessionCallbacks {
  /** Called once when a combat mission ends (all hostiles destroyed, or the player is lost). */
  onMissionEnd?(result: MissionResult): void;
}

export type StartMode = "runway" | "air";

export function startAircraftSession(View: typeof import("../rendering/three/ThreeCockpitView.js").ThreeCockpitView, frame: HTMLElement, definition: AircraftDefinition, mode: StartMode = "runway", scenario: TargetScenario = "range", options: Readonly<Record<string, string>> = {}, callbacks: SessionCallbacks = {}): AircraftSessionHandle {
  const { terrain, airfield } = createTestRange();
  const runway = airfield.runways[0];
  const startState = () => {
    // Runway start: lined up 150 m past the threshold, engine at idle, gear down, on the brakes' hold point.
    if (mode === "runway" && runway && definition.landingGear) {
      const lineUp = runwayLineUp(airfield, runway, 150);
      return { positionEnuM: [lineUp.positionEnuM[0], lineUp.positionEnuM[1], airfield.elevationM + (definition.landingGear.restCgHeightM ?? 2)] as const, headingRad: lineUp.headingRad, speedMps: 0, throttle: 0, onGround: true };
    }
    const s = terrain.sample(0, -18000);
    const ground = s.status === "valid" ? s.heightM : 0;
    return { positionEnuM: [0, -18000, ground + 1800] as const, headingRad: 0, speedMps: 160, throttle: 0.5 };
  };
  const jet = new FixedWingAircraft(definition, terrain, {
    originAltitudeMslM: 0, temperatureOffsetK: 0,
    wind: layeredWind("cockpit.wind", [{ heightM: 0, velocityEnuMps: [2, 1, 0] }, { heightM: 3000, velocityEnuMps: [12, -4, 0] }])
  }, { ...startState(), positionEnuM: [...startState().positionEnuM] });

  // Air targets (world truth) and the aircraft's avionics, stepped at a fixed rate in simulation time.
  const groundAt = (x: number, y: number) => { const t = terrain.sample(x, y); return t.status === "valid" ? t.heightM : Number.NaN; };
  // Combat bookkeeping: the player is "blue"; hostiles and range targets are "red".
  let shotDown: string | null = null;
  let missionOver = false;
  let shotsFired = 0;
  const hostileModel = new Map(hostileSpecs(scenario).map((h) => [h.id, h.modelId]));
  let hostiles: HostileFighter[] = [];
  const playerTarget = (): CombatTarget[] => {
    if (shotDown) return [];
    const s = jet.snapshot();
    return [{ id: "player", side: "blue", positionEnuM: s.positionEnuM, velocityEnuMps: s.velocityEnuMps }];
  };
  const hostileEnv: HostileEnvironment = {
    opponents: () => playerTarget(),
    threats: () => [
      ...notional.states().map((m) => ({ positionEnuM: m.positionEnuM, velocityEnuMps: m.velocityEnuMps, side: m.side })),
      ...missiles.states().map((m) => ({ positionEnuM: m.positionEnuM, velocityEnuMps: m.velocityEnuMps, side: "blue" as const }))
    ],
    groundHeightAt: groundAt,
    fire: (spec, shooter, targetId, cue) => { notional.launch(spec, "red", shooter.spec.id, shooter.positionEnuM, shooter.velocityEnuMps, cue, targetId); },
    missileInFlight: (shooterId, specId) => notional.states().some((m) => m.shooterId === shooterId && m.spec.id === specId)
  };
  const targets = new AirTargetWorld(targetsFor(scenario), { heightAt: groundAt }, () => {
    hostiles = hostileSpecs(scenario).map((h) => new HostileFighter(h, hostileEnv));
    return hostiles;
  });
  const missiles = new MissileWorld(targets, groundAt);
  // Active missile seekers radiate into the same RF world as the aircraft radars.
  targets.extraEmitters = () => notional.emitters();
  const notional = new NotionalMissileWorld(
    () => [...playerTarget(), ...targets.states().map((t) => ({ id: t.id, side: "red" as const, positionEnuM: t.positionEnuM, velocityEnuMps: t.velocityEnuMps }))],
    (id, m) => { if (id === "player") shotDown = `${m.spec.display}`; else targets.destroy(id); },
    groundAt
  );
  const weaponPort: WeaponPort = {
    launch: (...a) => { shotsFired++; return missiles.launch(...a); },
    events: (since) => missiles.events(since),
    launchNotional: (spec, p, v, cue) => { shotsFired++; return notional.launch(spec, "blue", "player", p, v, cue); },
    notionalEvents: (since) => notional.events(since)
  };
  const hostileCount = hostileModel.size;
  const kills = () => [...hostileModel.keys()].filter((id) => targets.isDestroyed(id)).length;
  let endAt: number | null = null;
  const checkMission = () => {
    if (missionOver) return;
    const crashed = jet.snapshot().ground.kind === "crashed";
    const outcome = shotDown ? "shot-down" : crashed && hostileCount > 0 ? "crashed" : hostileCount > 0 && kills() === hostileCount ? "victory" : null;
    if (!outcome) return;
    endAt ??= simTime + (outcome === "victory" ? 3 : 2.5);
    if (simTime < endAt) return;
    missionOver = true;
    callbacks.onMissionEnd?.({ outcome, kills: kills(), hostiles: hostileCount, timeS: simTime, shotsFired, ...(shotDown ? { cause: shotDown } : {}) });
  };
  const avionics = definition.createAvionics?.();
  for (const [k, v] of Object.entries(options)) avionics?.setOption?.(k, v);
  let simTime = 0, avionicsAcc = 0;
  const stepWorld = (dt: number, head: { az: number; el: number }) => {
    avionicsAcc += dt;
    const h = 1 / AVIONICS_RATE_HZ;
    while (avionicsAcc >= h) {
      avionicsAcc -= h;
      simTime += h;
      targets.step(h);
      missiles.step(h);
      notional.step(h);
      if (avionics) {
        const s = jet.snapshot();
        avionics.step({ own: { timeS: simTime, positionEnuM: s.positionEnuM, velocityEnuMps: s.velocityEnuMps, bodyToWorld: s.bodyToWorld, headingRad: s.headingRad, pitchRad: s.pitchRad, rollRad: s.rollRad }, snapshot: s, scene: targets, head, weapons: weaponPort }, h);
      }
      checkMission();
    }
  };

  const source: CockpitViewSource = {
    snapshot: () => jet.renderSnapshot(),
    hud: () => hud(jet.snapshot(), jet.definition.annunciate),
    mfd: (screen): MfdPage => definition.mfdPages?.[screen]?.(jet.snapshot()) ?? { title: screen.toUpperCase(), lines: [] },
    instrument: (id) => definition.cockpitInstruments?.[id]?.(jet.snapshot()) ?? [Number.NaN],
    cycleSwitch: (id) => { jet.controls.cycle(id, "cockpit-click"); },
    display: (id) => avionics?.screen(id),
    hudOverlay: () => avionics?.hud() ?? [],
    hudOwnedByPackage: () => avionics?.ownsHud === true,
    helmetOverlay: () => avionics?.helmet?.() ?? [],
    worldObjects: () => [
      ...targets.states().map((t) => ({ id: t.id, kind: "aircraft" as const, ...(hostileModel.has(t.id) ? { modelId: hostileModel.get(t.id)! } : {}), positionEnuM: t.positionEnuM, forwardEnu: t.forwardEnu, rightEnu: t.rightEnu, downEnu: t.downEnu })),
      ...notional.states().map((m) => ({ id: m.id, kind: "missile" as const, ...orient(m.velocityEnuMps), positionEnuM: m.positionEnuM, missile: { geometry: m.spec.geometry, burning: m.burning } })),
      ...missiles.renderables().map(({ state: m, geometry, burning }) => {
        // Orient by the missile's own nose (6-DoF attitude), wings level about it.
        const v = m.noseEnu, n = Math.hypot(...v) || 1;
        const f: [number, number, number] = [v[0] / n, v[1] / n, v[2] / n];
        const r = Math.hypot(f[1], f[0]) > 1e-6 ? [f[1] / Math.hypot(f[0], f[1]), -f[0] / Math.hypot(f[0], f[1]), 0] as [number, number, number] : [1, 0, 0] as [number, number, number];
        const d: [number, number, number] = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
        return { id: m.id, kind: "missile" as const, positionEnuM: m.positionEnuM, forwardEnu: f, rightEnu: r, downEnu: d, missile: { geometry, burning } };
      })
    ]
  };
  const view = new View(frame, definition.cockpit, terrain, { minM: [-20000, -20000], maxM: [20000, 20000], stepM: 200 }, source, [airfield], definition.exteriorModelId);
  const panel = mountDataPanel(frame, definition, () => jet.snapshot());
  const tones = new WarningTones();
  let paused = false;
  const restart = () => {
    const s = startState(); jet.reset({ ...s, positionEnuM: [...s.positionEnuM] }); targets.reset(); missiles.reset(); notional.reset(); avionics?.reset();
    simTime = 0; avionicsAcc = 0; throttle = s.throttle; stick = { pitch: 0, roll: 0, yaw: 0, brakes: 0 };
    shotDown = null; missionOver = false; shotsFired = 0; endAt = null;
  };

  const held = new Set<string>();
  let stick = { pitch: 0, roll: 0, yaw: 0, brakes: 0 };
  let throttle = jet.snapshot().throttle;
  void throttle;
  frame.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "pageup", "pagedown", "home", "end", "backspace", "enter"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (paused) return;
    if (k === "r") { restart(); return; }
    if (panel.onKey(k)) return;
    if (avionics?.key(k, true)) { e.preventDefault(); return; }
    const bound = jet.switchKeys.find((b) => b.key === k);
    if (bound) { jet.controls.cycle(bound.switchId, "keyboard"); return; }
    if (k === "v") { view.resetLook(); return; }
    if (k === "c") { view.toggleExternal(); return; }
    held.add(k);
  });
  frame.addEventListener("keyup", (e) => { held.delete(e.key.toLowerCase()); avionics?.key(e.key.toLowerCase(), false); });
  frame.addEventListener("blur", () => { held.clear(); for (const c of avionics?.controls ?? []) avionics?.key(c.key, false); });
  frame.addEventListener("pointerdown", () => frame.focus());

  let last: number | null = null;
  const loop = (now: number) => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const has = (...k: string[]) => k.some((x) => held.has(x));
    const axis = (p: boolean, n: boolean) => (p ? 1 : 0) - (n ? 1 : 0);
    const toward = (v: number, t: number, rate: number) => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
    stick = {
      pitch: toward(stick.pitch, axis(has("s"), has("w")), 2.5),
      roll: toward(stick.roll, axis(has("d"), has("a")), 3),
      yaw: toward(stick.yaw, axis(has("e"), has("q")), 3),
      brakes: has(" ") ? 1 : 0
    };
    if (has("shift")) throttle = Math.min(1, throttle + 0.4 * dt);
    if (has("control")) throttle = Math.max(0, throttle - 0.4 * dt);
    jet.setPilotInputs(stick);
    jet.setThrottle(throttle);
    if (!paused && !missionOver) {
      // A shot-down aircraft stops flying; the world keeps running until the debrief.
      if (!shotDown) jet.advanceFrame(dt);
      // Helmet sight = the pilot's view direction (view yaw is positive to the left).
      stepWorld(dt, { az: -view.look.yaw, el: view.look.pitch });
    }
    view.render();
    panel.update();
    if (!paused && avionics?.audioCues) tones.update(avionics.audioCues()); else tones.update(null);
    if (raf !== -1) raf = requestAnimationFrame(loop);
  };
  let raf = requestAnimationFrame(loop);
  frame.focus();
  return {
    get paused() { return paused; },
    setPaused(p: boolean) { paused = p; held.clear(); if (!p) { last = null; frame.focus(); } },
    restart,
    dispose() { cancelAnimationFrame(raf); raf = -1; tones.dispose(); view.dispose(); }
  };
}

/** Render basis from a velocity vector (wings level about it). */
function orient(v: readonly [number, number, number]): { forwardEnu: [number, number, number]; rightEnu: [number, number, number]; downEnu: [number, number, number] } {
  const n = Math.hypot(...v) || 1;
  const f: [number, number, number] = [v[0] / n, v[1] / n, v[2] / n];
  const h = Math.hypot(f[0], f[1]);
  const r: [number, number, number] = h > 1e-6 ? [f[1] / h, -f[0] / h, 0] : [1, 0, 0];
  const d: [number, number, number] = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { forwardEnu: f, rightEnu: r, downEnu: d };
}

function hud(s: AircraftSnapshot, annunciate?: (s: AircraftSnapshot) => readonly { readonly text: string; readonly level: "caution" | "warning" }[]): HudData {
  const warnings: { text: string; level: "caution" | "warning" }[] = [];
  if (s.ground.kind === "crashed") warnings.push({ text: `CRASHED at ${(s.ground.impactSpeedMps * KT).toFixed(0)} kt${s.ground.reason ? ` (${s.ground.reason})` : ""} — press R`, level: "warning" });
  if (s.ground.kind === "terrain-unknown") warnings.push({ text: "TERRAIN DATA UNAVAILABLE", level: "caution" });
  if (s.ground.kind === "airborne" && s.ground.aglM < 150 && s.verticalSpeedMps < -5) warnings.push({ text: "PULL UP", level: "warning" });
  for (const a of s.annunciations) warnings.push({ text: a, level: a.includes("DIRECT") ? "warning" : "caution" });
  if (s.outsideAeroEnvelope && s.ground.kind === "airborne") warnings.push({ text: "OUTSIDE AERO DATA ENVELOPE", level: "caution" });
  if (s.engines.some((e) => e.flameout)) warnings.push({ text: "ENGINE FLAMEOUT — FUEL", level: "warning" });
  if (s.engines.some((e) => e.control.mode === "backup")) warnings.push({ text: "ENGINE CONTROL: BACKUP (SEC)", level: "caution" });
  for (const a of s.lights) warnings.push({ text: a.text, level: a.level });
  for (const a of annunciate?.(s) ?? []) warnings.push({ text: a.text, level: a.level });
  if (s.faults.length > 0) warnings.push({ text: `SIM FAULT: ${s.faults[s.faults.length - 1]}`, level: "warning" });
  return {
    airspeedKt: s.equivalentAirspeedMps * KT,
    mach: s.mach,
    altitudeFt: s.altitudeMslM * FT,
    headingDeg: s.headingRad * DEG,
    nzG: s.nzG,
    alphaDeg: s.alphaRad * DEG,
    warnings
  };
}
