/**
 * Page section that launches the F-16C Block 50 cockpit on demand.
 * Three.js and the view are loaded lazily, so the rest of the page stays light.
 */
import { createTestTerrain } from "../debug/DebugFlyer.js";
import { layeredWind } from "../physics/environment/Atmosphere.js";
import { F16Aircraft, F16_SWITCHES, type F16Snapshot } from "../platforms/aircraft/f16c-block50/F16Aircraft.js";
import { F16_COCKPIT_LAYOUT } from "../platforms/aircraft/f16c-block50/F16CockpitLayout.js";
import { F16_ENGINE } from "../platforms/aircraft/f16c-block50/F16Data.js";
import type { CockpitViewSource, HudData, MfdPage } from "../rendering/three/ThreeCockpitView.js";

const DEG = 180 / Math.PI;
const KT = 1.943844;
const FT = 3.28084;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function mountF16Cockpit(parent: HTMLElement): void {
  const section = el("section", "panel flight");
  section.setAttribute("aria-label", "F-16C Block 50 cockpit");
  const head = el("div", "monitor-head");
  const titles = el("div");
  titles.append(
    el("p", "panel-label", "F-16C BLOCK 50 · PROVISIONAL FLIGHT MODEL"),
    el("p", "panel-note", "NASA TP-1538 low-speed F-16 wind-tunnel data (not Block 50-specific), estimated F110 engine, project-designed fly-by-wire. Untextured cockpit; Three.js renderer is provisional (ADR-0002).")
  );
  const start = el("button", "ghost", "Start F-16");
  start.type = "button";
  head.append(titles, start);
  const frame = el("div", "cockpit-frame");
  frame.tabIndex = 0;
  frame.setAttribute("aria-label", "F-16 cockpit view. Click, then use the keyboard to fly.");
  const hint = el("p", "flight-hint", "Press Start F-16");
  frame.append(hint);
  const help = el("p", "panel-note flight-help",
    "Keys: W/S pitch · A/D roll · Q/E yaw · Shift/Ctrl throttle · F fly-by-wire NORM/DIRECT · C CG test setting · R reset. Click the yellow (FLCS) and blue (CG) console switches. FLCS DIRECT and CG are simulation test switches, not real F-16 controls.");
  section.append(head, frame, help);
  parent.append(section);

  start.addEventListener("click", async () => {
    start.disabled = true;
    hint.textContent = "Loading…";
    try {
      const { ThreeCockpitView } = await import("../rendering/three/ThreeCockpitView.js");
      hint.hidden = true;
      run(ThreeCockpitView, frame, start);
    } catch (e) {
      hint.textContent = `Could not start the 3D cockpit: ${e instanceof Error ? e.message : String(e)}`;
      start.disabled = false;
    }
  });
}

function run(View: typeof import("../rendering/three/ThreeCockpitView.js").ThreeCockpitView, frame: HTMLElement, start: HTMLButtonElement): void {
  const terrain = createTestTerrain();
  const startState = () => {
    const s = terrain.sample(0, -12000);
    const ground = s.status === "valid" ? s.heightM : 0;
    return { positionEnuM: [0, -12000, ground + 1800] as const, headingRad: 0, speedMps: 160, throttle: 0.5 };
  };
  const jet = new F16Aircraft(terrain, {
    originAltitudeMslM: 0, temperatureOffsetK: 0,
    wind: layeredWind("cockpit.wind", [{ heightM: 0, velocityEnuMps: [2, 1, 0] }, { heightM: 3000, velocityEnuMps: [12, -4, 0] }])
  }, { ...startState(), positionEnuM: [...startState().positionEnuM] });

  const source: CockpitViewSource = {
    snapshot: () => jet.snapshot(),
    hud: () => hud(jet.snapshot()),
    mfd: (screen) => mfd(screen, jet.snapshot()),
    cycleSwitch: (id) => { jet.controls.cycle(id, "cockpit-click"); }
  };
  const view = new View(frame, F16_COCKPIT_LAYOUT, terrain, { minM: [-20000, -20000], maxM: [20000, 20000], stepM: 200 }, source);
  start.textContent = "Running";

  const held = new Set<string>();
  let stick = { pitch: 0, roll: 0, yaw: 0 };
  let throttle = jet.snapshot().throttle;
  frame.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === "r") { const s = startState(); jet.reset({ ...s, positionEnuM: [...s.positionEnuM] }); throttle = s.throttle; stick = { pitch: 0, roll: 0, yaw: 0 }; return; }
    if (k === "f") { jet.controls.cycle(F16_SWITCHES.flcsMode, "keyboard"); return; }
    if (k === "c") { jet.controls.cycle(F16_SWITCHES.testCg, "keyboard"); return; }
    held.add(k);
  });
  frame.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  frame.addEventListener("blur", () => held.clear());
  frame.addEventListener("pointerdown", () => frame.focus());

  let last: number | null = null;
  const loop = (now: number) => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const has = (...k: string[]) => k.some((x) => held.has(x));
    const axis = (p: boolean, n: boolean) => (p ? 1 : 0) - (n ? 1 : 0);
    const toward = (v: number, t: number, rate: number) => (v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt));
    stick = {
      pitch: toward(stick.pitch, axis(has("s", "arrowdown"), has("w", "arrowup")), 2.5),
      roll: toward(stick.roll, axis(has("d", "arrowright"), has("a", "arrowleft")), 3),
      yaw: toward(stick.yaw, axis(has("e"), has("q")), 3)
    };
    if (has("shift")) throttle = Math.min(1, throttle + 0.4 * dt);
    if (has("control")) throttle = Math.max(0, throttle - 0.4 * dt);
    jet.setPilotInputs(stick);
    jet.setThrottle(throttle);
    jet.advanceFrame(dt);
    view.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  frame.focus();
}

function hud(s: F16Snapshot): HudData {
  const warnings: { text: string; level: "caution" | "warning" }[] = [];
  if (s.ground.kind === "crashed") warnings.push({ text: `CRASHED at ${(s.ground.impactSpeedMps * KT).toFixed(0)} kt — press R`, level: "warning" });
  if (s.ground.kind === "terrain-unknown") warnings.push({ text: "TERRAIN DATA UNAVAILABLE", level: "caution" });
  if (s.ground.kind === "airborne" && s.ground.aglM < 150 && s.verticalSpeedMps < -5) warnings.push({ text: "PULL UP", level: "warning" });
  if (s.flcsMode === "DIRECT") warnings.push({ text: "FLCS DIRECT — NO AUGMENTATION (TEST)", level: "warning" });
  if (s.alphaLimiting) warnings.push({ text: "AOA LIMIT", level: "caution" });
  if (s.outsideAeroEnvelope) warnings.push({ text: "OUTSIDE AERO DATA ENVELOPE", level: "caution" });
  if (s.engine.flameout) warnings.push({ text: "ENGINE FLAMEOUT — FUEL", level: "warning" });
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

function mfd(screen: string, s: F16Snapshot): MfdPage {
  if (screen === "mfd-left") {
    const max = F16_ENGINE.maxAfterburnerThrustN.value;
    return {
      title: "ENG",
      lines: [
        `THR  ${(s.throttle * 100).toFixed(0).padStart(3)} %`,
        `PWR  ${(s.engine.power * 100).toFixed(0).padStart(3)} %`,
        `THRUST ${(s.engine.thrustN / 1000).toFixed(1)} kN`,
        `       ${((s.engine.thrustN / max) * 100).toFixed(0)}% of max`,
        `A/B  ${s.engine.afterburner ? "ON" : "OFF"}`,
        `FF   ${(s.engine.fuelFlowKgS * 3600).toFixed(0)} kg/h`,
        `FUEL ${s.engine.fuelKg.toFixed(0)} kg`,
        "ENGINE MODEL: ESTIMATED"
      ]
    };
  }
  return {
    title: `FLCS ${s.flcsMode}`,
    lines: [
      `STAB ${s.surfaces.elevatorDeg.toFixed(1).padStart(6)}°`,
      `FLPN ${s.surfaces.aileronDeg.toFixed(1).padStart(6)}°`,
      `RUD  ${s.surfaces.rudderDeg.toFixed(1).padStart(6)}°`,
      `AOA  ${(s.alphaRad * DEG).toFixed(1).padStart(6)}°`,
      `NZ   ${s.nzG.toFixed(2).padStart(6)} g`,
      `CG   ${(s.cgFractionMac * 100).toFixed(0)}% MAC`,
      `     ${s.switches[F16_SWITCHES.testCg] ?? ""}`,
      s.alphaLimiting ? "AOA LIMITER ACTIVE" : ""
    ]
  };
}
