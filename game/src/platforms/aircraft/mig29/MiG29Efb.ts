/**
 * MiG-29 EFB pages (UI only): this aircraft's own systems drawn from its snapshot — twin RD-33
 * engines fed from tank 2, the GAF tank arrangement with turbo/jet pumps, the gearbox-driven AC/DC
 * generators with PTO and batteries, the main/boost hydraulic systems with the emergency pump, and
 * the main/emergency nitrogen systems with their regulators and consumers.
 * Layouts are schematic (after GAF T.O. 1F-MIG29-1 figs. 1-18/1-19 and the system descriptions).
 */
import { accumulator, box, checkValve, COLORS, engineCutaway, engineHealthPanel, hbar, num, pipe, pump, svg, tank, text, valve } from "../../../app/efb/EfbKit.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { MIG29_HYDRAULICS, MIG29_PNEUMATICS } from "./MiG29Data.js";
import { MIG29_SWITCHES } from "./MiG29Definition.js";
import { F34_KG_PER_L } from "./MiG29FuelSystem.js";

type Snap = AircraftSnapshot;
const kg = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.kg ?? 0;
const cap = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.capacityKg ?? 1;
const eng = (s: Snap, id: string) => s.engines.find((e) => e.id === id);
const gbxSpeed = (s: Snap) => { const l = eng(s, "left")?.spoolSpeed ?? 0, r = eng(s, "right")?.spoolSpeed ?? 0; return l >= r + MIG29_HYDRAULICS.gearboxEngineSelectMargin.value ? { v: l, by: "LH" } : { v: r, by: "RH" }; };

/** Live transfer flow between two places (from the fuel system's own report). */
const flowing = (s: Snap, from: string, to: string) => (s.fuelComponents?.flows ?? []).some((f) => f.from === from && f.to === to && f.kgS > 0.01);
const pumpOn = (s: Snap, id: string) => (s.fuelComponents?.pumps ?? []).find((p) => p.id === id)?.running ?? false;
const valveOpen = (s: Snap, id: string) => (s.fuelComponents?.valves ?? []).find((v) => v.id === id)?.open ?? false;

function intakeBox(x: number, s: Snap, id: string, label: string): string {
  const st = s.inlets?.[id];
  if (!st) return "";
  const state = st.mode === "NO HYD" ? "warn" : st.mode === "FOD" ? "shed" : "on";
  return box(x, 34, 190, 92, `${label} INTAKE · ${st.mode}`, [
    `ramp ${(st.rampExtension * 100).toFixed(0)} % (sched ${(st.rampScheduled * 100).toFixed(0)} %)`,
    `aux louvers ${st.auxOpen ? "OPEN" : "closed"}`,
    `duct ${st.rampExtension > 0.8 ? "CLOSED (FOD)" : "open"}`,
    `distortion ${(st.distortion * 100).toFixed(0)} %`
  ], state);
}

function enginesPage(s: Snap): string {
  const l = eng(s, "left"), r = eng(s, "right");
  const g = gbxSpeed(s);
  const feedL = flowing(s, "tank2", "left") || flowing(s, "accumulator", "left"), feedR = flowing(s, "tank2", "right") || flowing(s, "accumulator", "right");
  const lim = { oilTempWarnC: 195, oilPressMinPa: 1.8 * 98066.5 };
  return svg(800, 1080, `
    ${intakeBox(16, s, "left", "LH")}${intakeBox(594, s, "right", "RH")}
    ${tank(350, 30, 100, 56, kg(s, "tank2"), cap(s, "tank2"), "TANK 2 · FEED")}
    ${pipe([[380, 86], [380, 118], [100, 118], [100, 150]], { flow: feedL })}${pipe([[420, 86], [420, 118], [700, 118], [700, 150]], { flow: feedR })}
    ${l ? engineCutaway(100, 150, l, "right", `LH ${num(l.spoolSpeed * 100, 1)} % NH`) : ""}
    ${r ? engineCutaway(700, 150, r, "left", `RH ${num(r.spoolSpeed * 100, 1)} % NH`) : ""}
    ${box(320, 515, 160, 54, "GEARBOX (GBX)", [`${g.by} engine · ${num(g.v * 100, 1)} %`, "AC+DC GEN · 2 HYD · fuel"], g.v > 0.5 ? "on" : "warn")}
    ${text(400, 590, `${num(s.engines.reduce((a, e) => a + e.netThrustN, 0) / 1000, 1)} kN · ${num(s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600)} kg/h`, { anchor: "middle", size: 15, weight: 700 })}
    ${text(400, 610, `${(s.engines[0]?.control.mode ?? "").toUpperCase()} · ${s.engines.flatMap((e) => e.control.activeLimits).join(", ") || "no limiter"}`, { anchor: "middle", size: 10, color: COLORS.dim })}
    ${text(16, 642, "ENGINE HEALTH", { size: 13, weight: 700, color: "#7fd4ff" })}
    ${l ? engineHealthPanel(10, 650, 385, l, "LH RD-33", lim) : ""}${r ? engineHealthPanel(405, 650, 385, r, "RH RD-33", lim) : ""}
    ${text(10, 1076, "Oil warn >195 °C; <1.8 kp/cm² (50–89 %) / <2.7 (>89 %) — GAF T.O.; margins estimated", { size: 9, color: COLORS.dim })}`);
}

function fuelPage(s: Snap): string {
  const t = (id: string, x: number, y: number, w: number, h: number, label: string, shape?: string) =>
    tank(x, y, w, h, kg(s, id), cap(s, id), label, { ...(shape ? { shape } : {}), active: (s.fuelComponents?.flows ?? []).some((f) => (f.from === id || f.to === id) && f.kgS > 0.01) });
  const hasCl = s.fuelTanks?.some((x) => x.id === "centerline") ?? false;
  const total = s.fuelKg, ff = s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600;
  const outer = (id: string) => flowing(s, id, "tank3");
  const feed = s.engines.some((e) => flowing(s, "tank2", e.id));
  const acc = s.engines.some((e) => flowing(s, "accumulator", e.id));
  return svg(600, 700, `
    ${text(20, 34, `${total.toFixed(0)} kg`, { size: 22 })}
    ${text(20, 56, `${(total / F34_KG_PER_L).toFixed(0)} L F-34`, { size: 12, color: COLORS.dim })}
    ${text(20, 84, `${ff.toFixed(0)} kg/h`, { size: 16 })}
    ${text(20, 104, `endurance ${ff > 1 ? (total / ff * 60).toFixed(0) : "—"} min`, { size: 11, color: COLORS.dim })}
    ${text(20, 130, `CG ${(s.cgFractionMac * 100).toFixed(1)} % MAC`, { size: 13 })}
    ${text(20, 152, `active-fuel pump ${pumpOn(s, "activeFuel") ? "ON" : "OFF"}`, { size: 11, color: pumpOn(s, "activeFuel") ? COLORS.ok : COLORS.warn })}
    ${kg(s, "tank2") < 550 ? text(20, 176, "550 KG REMAIN", { size: 13, color: COLORS.caution, weight: 700 }) : ""}
    ${hbar(20, 214, 170, "ACCUMULATOR (tank 3)", (s.fuelComponents?.accumulatorKg ?? 0) / (s.fuelComponents?.accumulatorCapacityKg ?? 1), `${num(s.fuelComponents?.accumulatorKg, 0)} kg`, acc ? COLORS.caution : COLORS.ok)}
    ${acc ? text(20, 198, "ACCUMULATOR FEED (near-zero g)", { size: 12, color: COLORS.caution, weight: 700 }) : ""}
    ${text(20, 240, `boost pumps ${pumpOn(s, "boost") ? "ON" : "OFF"}`, { size: 11, color: pumpOn(s, "boost") ? COLORS.ok : COLORS.warn })}
    ${pipe([[300, 110], [300, 130]], { flow: flowing(s, "tank1", "tank2") })}
    ${pipe([[350, 300], [350, 262], [390, 262], [390, 170], [360, 170]], { flow: flowing(s, "tank3", "tank2") })}
    ${pipe([[250, 300], [250, 262], [210, 262], [210, 75], [240, 75]], { flow: flowing(s, "tank3", "tank1") })}
    ${pipe([[195, 285], [218, 285], [218, 360], [230, 360]], { flow: outer("wingL") })}${pipe([[405, 285], [382, 285], [382, 360], [370, 360]], { flow: outer("wingR") })}
    ${pipe([[180, 470], [180, 420], [230, 420]], { flow: outer("tank3A1") })}${pipe([[420, 470], [420, 420], [370, 420]], { flow: outer("tank3A2") })}
    ${pipe([[300, 210], [300, 246], [30, 246], [30, 668]], { flow: feed || acc })}${pipe([[300, 246], [570, 246], [570, 668]], { flow: feed || acc })}
    ${t("tank1", 240, 40, 120, 70, "TANK 1")}${pump(258, 100, pumpOn(s, "tank1Turbo"))}
    ${t("tank2", 240, 130, 120, 80, "TANK 2 · FEED")}${valve(300, 120, valveOpen(s, "tank1Level"))}
    ${t("tank3", 230, 300, 140, 140, "TANK 3")}${pump(350, 428, pumpOn(s, "tank3Turbo"))}${pump(250, 428, pumpOn(s, "tank3Jet"))}${valve(390, 230, valveOpen(s, "tank3Level"))}
    ${text(300, 462, "ACC", { anchor: "middle", size: 9, color: acc ? COLORS.caution : COLORS.dim })}
    ${t("wingL", 45, 262, 150, 70, "WING L", "M45,300 L195,262 L195,312 L65,332 Z")}${t("wingR", 405, 262, 150, 70, "WING R", "M555,300 L405,262 L405,312 L535,332 Z")}
    ${pump(185, 300, outer("wingL"), 6)}${pump(415, 300, outer("wingR"), 6)}
    ${t("tank3A1", 150, 470, 60, 130, "3A1")}${t("tank3A2", 390, 470, 60, 130, "3A2")}${pump(180, 590, outer("tank3A1"), 6)}${pump(420, 590, outer("tank3A2"), 6)}
    ${text(30, 686, "LH ENG", { anchor: "middle", size: 10 })}${text(570, 686, "RH ENG", { anchor: "middle", size: 10 })}
    ${hasCl ? `${pipe([[345, 640], [520, 640], [520, 20], [300, 20], [300, 40]], { flow: flowing(s, "centerline", "tank1") })}${t("centerline", 255, 615, 90, 55, "CL TANK")}${valve(520, 330, valveOpen(s, "clTransfer"))}` : text(300, 650, "no CL tank fitted", { anchor: "middle", size: 10, color: COLORS.dim })}`);
}

function electricsPage(s: Snap): string {
  const el = s.electrical;
  if (!el) return svg(600, 200, text(20, 40, "No electrical model"));
  const src = (id: string) => el.sources.find((x) => x.id === id);
  const bus = (id: string) => el.buses.find((x) => x.id === id);
  const g = gbxSpeed(s);
  const AC = "#ff8080", ACF = "#ffc9c9", DC = "#7f9cff", DCF = "#c9d5ff";
  const ac = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: AC, fluid: ACF });
  const dc = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: DC, fluid: DCF });
  const srcBox = (x: number, y: number, w: number, id: string, name: string, extra: string) => { const o = src(id); return box(x, y, w, 58, name, [o?.tripped ? "TRIPPED" : o?.online ? "ON LINE" : o?.available ? "AVAILABLE" : "OFF", extra], o?.tripped ? "warn" : o?.online ? "on" : o?.available ? "shed" : "off"); };
  const busBox = (x: number, y: number, id: string, name: string) => { const b = bus(id); return b ? box(x, y, 170, 58, name, [b.powered ? `← ${({ "gen.ac": "AC GEN", pto: "PTO", "gen.dc": "DC GEN", battery: "BATTERIES", transformer: "TRANSFORMER", pto36: "PTO 36 V" } as Record<string, string>)[b.sourceId ?? ""] ?? b.sourceId}` : "UNPOWERED", b.shed ? "non-essential SHED" : `${num(b.loadW / 1000, 1)} kW`], !b.powered ? "warn" : b.shed ? "shed" : "on", id === "dc" ? "#9bb0ff" : "#ff9b9b") : ""; };
  const sw = (id: string, label: string, x: number) => { const on = (s.switches[id] ?? "ON") === "ON"; return `<rect x="${x}" y="606" width="104" height="26" rx="3" fill="${on ? "#1f3a24" : "#3a1f1f"}" stroke="#555"/>${text(x + 52, 623, `${label} ${on ? "ON" : "OFF"}`, { size: 9, anchor: "middle", weight: 700 })}`; };
  const acGen = src("gen.ac")?.online ?? false, dcGen = src("gen.dc")?.online ?? false, ptoOn = src("pto")?.online ?? false, pto36 = src("pto36")?.online ?? false, tr = src("transformer")?.online ?? false, bat = src("battery")?.online ?? false;
  return svg(600, 690, `
    ${box(210, 8, 180, 50, "GEARBOX (GBX)", [`${g.by} engine · ${num(g.v * 100, 1)} %`], g.v > 0.5 ? "on" : "warn")}
    ${ac([[250, 58], [250, 80], [95, 80], [95, 96]], acGen)}${dc([[350, 58], [350, 80], [505, 80], [505, 96]], dcGen)}
    ${box(16, 96, 158, 46, "CSD 12,000 rpm", [s.switches["mig29.test.electrical-fault"] === "CSD OVERSPEED" ? "DISCONNECTED" : "constant speed"], s.switches["mig29.test.electrical-fault"] === "CSD OVERSPEED" ? "warn" : "on")}
    ${srcBox(16, 152, 158, "gen.ac", "AC GEN 30 kVA", "115/200 V 400 Hz")}
    ${srcBox(426, 96, 158, "gen.dc", "DC GEN 12 kW", "28.5 V · 400 A")}
    ${ac([[95, 210], [95, 260]], acGen)}${busBox(10, 260, "ac", "AC BUS 115 V")}
    ${ac([[180, 289], [215, 289]], tr)}${srcBox(215, 260, 150, "transformer", "TRANSFORMER", "→ 36 V 1.5 kVA")}
    ${ac([[290, 318], [290, 360]], tr || pto36)}${busBox(205, 360, "ac36", "AC BUS 36 V")}
    ${dc([[505, 154], [505, 260]], dcGen || bat)}${busBox(420, 260, "dc", "DC BUS 28 V")}
    ${srcBox(426, 380, 158, "battery", "BATTERIES 2×45 Ah", `${num(src("battery")?.chargeAh ?? 0, 1)} Ah · Ag-Zn`)}
    ${dc([[505, 380], [505, 318]], bat)}
    ${box(215, 460, 170, 60, "PTO DC/AC CONVERTER", [`115 V ${ptoOn ? "ON" : "off"} · 36 V ${pto36 ? "ON" : "off"}`, "1.5 kVA / 1 kVA"], ptoOn || pto36 ? "shed" : "off")}
    ${dc([[420, 300], [400, 300], [400, 490], [385, 490]], ptoOn || pto36)}${ac([[215, 480], [95, 480], [95, 318]], ptoOn)}${ac([[300, 460], [300, 418]], pto36)}
    ${text(16, 556, "Shed on the PTO (GAF): INS heaters · radar & sight · IRST/LRF/HMS · AOA/sideslip heaters", { size: 9, color: COLORS.dim })}
    ${text(16, 570, "windshield heat · AFCS · armament · IFF encoder. On transformer failure: LRF, rate sensors, ILS.", { size: 9, color: COLORS.dim })}
    ${text(16, 586, "Batteries are not charged by the generator (Ag-Zn charging voltage above generator voltage).", { size: 9, color: COLORS.dim })}
    ${sw("mig29.elec.bat-gnd", "BAT-GND", 16)}${sw("mig29.elec.dc-gen", "DC GEN", 128)}${sw("mig29.elec.ac-gen", "AC GEN", 240)}${sw("mig29.elec.pto", "PTO", 352)}
    ${text(16, 660, "Electrical power panel (RH console). Loads estimated; source data GAF T.O. 1F-MIG29-1.", { size: 9, color: COLORS.dim })}`);
}

/** Live schematic: GBX pumps → main/boost; pressure limiter isolates the utilities below 13 MPa. */
/**
 * Nitrogen systems: every value comes from the pneumatic snapshot (bottle pressure, temperature and
 * inventory; regulator outlets; consumer supply and gas use) or the gear/switch state.
 */
function pneumaticsPage(s: Snap): string {
  const pn = s.pneumatics;
  if (!pn) return svg(600, 200, text(20, 40, "No pneumatic model"));
  const N2 = "#9ad0ff", N2F = "#e0f2ff", N2_KG_PER_MOL = 0.0280134;
  const gas = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: N2, fluid: N2F });
  const sys = (id: string) => pn.systems.find((x) => x.id === id);
  const reg = (id: string) => pn.regulators.find((x) => x.id === id);
  const con = (id: string) => pn.consumers.find((x) => x.id === id);
  const using = (id: string) => (con(id)?.usedMolS ?? 0) > 1e-9;
  const gS = (id: string) => `${num((con(id)?.usedMolS ?? 0) * N2_KG_PER_MOL * 1000, 2)} g/s`;
  const MPa = (pa: number | undefined) => `${num((pa ?? Number.NaN) / 1e6, 1)} MPa`;
  const bottle = (x: number, id: string, label: string, chargePa: number) => {
    const b = sys(id);
    const f = b ? b.pressurePa / chargePa : 0, low = f < 0.4;
    return `${accumulator(x, 60, 70, 120, f, low ? COLORS.warn : N2)}
      ${text(x + 35, 50, label, { anchor: "middle", size: 12, weight: 700, color: "#7fd4ff" })}
      ${text(x + 85, 84, MPa(b?.pressurePa), { size: 14, weight: 700, color: low ? COLORS.warn : COLORS.text })}
      ${text(x + 85, 102, `charge ${MPa(chargePa)}`, { size: 10, color: COLORS.dim })}
      ${text(x + 85, 118, `${num((b?.inventoryFraction ?? 0) * 100)} % gas`, { size: 10, color: COLORS.dim })}
      ${text(x + 85, 134, `${num((b?.temperatureK ?? Number.NaN) - 273.15)} °C`, { size: 10, color: COLORS.dim })}`;
  };
  const legs = s.gear?.legExtension ?? {};
  const leg = (id: string) => `${num((legs[id] ?? Number.NaN) * 100)} %`;
  const handle = s.switches[MIG29_SWITCHES.emergencyGear] ?? "—";
  const brakes = con("brakes.normal"), res = con("hyd.reservoir");
  const gearMoving = using("gear.emergency.nose") || using("gear.emergency.main");
  const fault = (f: (typeof pn.faults)[number]) => f.kind === "system-leak" ? `LEAK ${f.systemId}` : f.kind === "regulator-failed" ? `${f.regulatorId} FAILED ${f.mode.toUpperCase()}` : `CHECK VALVE ${f.systemA}/${f.systemB}`;
  return svg(600, 560, `
    ${text(16, 24, "NITROGEN SYSTEMS (GAF T.O. 1F-MIG29-1) · no in-flight recharge", { size: 11, color: COLORS.dim })}
    ${bottle(20, "main", "MAIN", MIG29_PNEUMATICS.mainChargePa.value)}
    ${bottle(220, "emergency", "EMERGENCY", MIG29_PNEUMATICS.emergencyChargePa.value)}
    ${bottle(420, "chute", "CHUTE", MIG29_PNEUMATICS.chuteChargePa.value)}
    ${gas([[55, 180], [55, 230]], using("brakes.normal") || using("hyd.reservoir"))}${checkValve(55, 205, "down", true)}
    ${gas([[55, 230], [55, 260], [196, 260], [196, 300]], using("hyd.reservoir"))}
    ${gas([[55, 230], [55, 300]], using("brakes.normal"))}
    ${box(10, 300, 130, 54, "BRAKE REG", [MPa(reg("reg.brakes")?.outletPa)], (reg("reg.brakes")?.outletPa ?? 0) > 0 ? "on" : "warn")}
    ${box(150, 300, 92, 54, "RES REG", [MPa(reg("reg.reservoir")?.outletPa)], (reg("reg.reservoir")?.outletPa ?? 0) > 0 ? "on" : "warn")}
    ${gas([[75, 354], [75, 390]], using("brakes.normal"))}${gas([[196, 354], [196, 390]], using("hyd.reservoir"))}
    ${box(10, 390, 130, 70, "WHEEL BRAKES", [`supply ${num((brakes?.supplyFraction ?? 0) * 100)} %`, `gas ${gS("brakes.normal")}`], (brakes?.supplyFraction ?? 0) > 0.5 ? "on" : "warn")}
    ${box(150, 390, 92, 70, "HYD RES", [`press ${num((res?.supplyFraction ?? 0) * 100)} %`, `gas ${gS("hyd.reservoir")}`], (res?.supplyFraction ?? 0) > 0.5 ? "on" : "warn")}
    ${gas([[255, 180], [255, 300]], gearMoving)}${checkValve(255, 205, "down", gearMoving)}${valve(255, 260, handle !== "STOWED")}
    ${box(290, 300, 150, 160, "EMERG GEAR", [`handle ${handle}`, `nose ${leg("nose")}`, `left ${leg("left")}`, `right ${leg("right")}`, `supply ${num((con("gear.emergency.nose")?.supplyFraction ?? 0) * 100)} %`, `gas ${num(((con("gear.emergency.nose")?.usedMolS ?? 0) + (con("gear.emergency.main")?.usedMolS ?? 0)) * N2_KG_PER_MOL * 1000, 1)} g/s`], (con("gear.emergency.nose")?.supplyFraction ?? 0) > 0.5 ? "on" : "warn")}
    ${gas([[255, 300], [255, 380], [290, 380]], gearMoving)}
    ${box(450, 300, 140, 70, "DRAG CHUTE", ["bottle only", "deploy not modelled"], "off")}
    ${text(16, 490, "FAULTS", { size: 12, weight: 700, color: "#7fd4ff" })}
    ${(pn.faults.length ? pn.faults.map(fault) : ["none"]).map((t, i) => text(16, 508 + 16 * i, t, { size: 11, color: pn.faults.length ? COLORS.warn : COLORS.dim })).join("")}
    ${text(300, 552, "Volumes, regulated pressures and flows ESTIMATED", { size: 9, color: COLORS.dim, anchor: "middle" })}`);
}

function hydraulicsPage(s: Snap): string {
  const h = s.hydraulics;
  if (!h) return svg(600, 200, text(20, 40, "No hydraulic model"));
  const MPa = (pa: number) => pa / 1e6, Q = 1e-7;
  const RED = "#ff4d7a", REDF = "#ffb3c6", GRN = "#7ee787", GRNF = "#d2ffd9", BLU = "#29b6f6", BLUF = "#b3e5fc";
  const red = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: RED, fluid: REDF });
  const grn = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: GRN, fluid: GRNF });
  const blu = (pts: [number, number][], on: boolean) => pipe(pts, { flow: on, color: BLU, fluid: BLUF });
  const flow = (id: string) => h.consumers?.find((c) => c.id === id)?.flowM3s ?? 0;
  const lpm = (m3s: number) => m3s * 60000;
  const g = gbxSpeed(s), util = h.branches?.find((b) => b.id === "main.util");
  const surf = (id: string) => Math.abs(s.surfaces[id] ?? 0);
  const user = (x: number, y: number, name: string, value: string, on: boolean) => `<rect x="${x}" y="${y - 14}" width="104" height="28" rx="3" fill="${on ? "#3a1f2a" : "#1c1d1f"}" stroke="${on ? RED : "#555"}"/>${text(x + 4, y - 2, name, { size: 9, weight: 600 })}${text(x + 4, y + 10, value, { size: 9, color: COLORS.dim })}`;
  const system = (x0: number, id: "main" | "booster") => {
    const c = h.circuits.find((k) => k.id === id);
    if (!c) return "";
    const p = MPa(c.pressurePa), pumping = c.pumpFlowM3s > Q, M = x0 + 120, U = x0 + 160, R = x0 + 284;
    const ctrlOn = c.demandFlowM3s > Q;
    const cpi = Math.max(p, MPa(MIG29_HYDRAULICS.accumulatorPrechargePa.value)); // CPI reads the accumulator gas side
    const rows: string[] = [];
    rows.push(`${red([[M, 140], [U, 140]], ctrlOn)}${user(U, 140, id === "main" ? "FLT CTRL 2nd ch" : "FLT CTRL 1st ch", "stab·ail·rud·COC", ctrlOn)}${grn([[U + 104, 140], [R, 140]], ctrlOn)}`);
    if (id === "main") {
      rows.push(`${red([[M, 190], [U, 190]], surf("lef") > 0.1)}${user(U, 190, "FLAPS / LEF", `${num(surf("lef"))}°`, false)}${grn([[U + 104, 190], [R, 190]], false)}`);
      const uOn = (util?.chargeFlowM3s ?? 0) > Q;
      rows.push(`${red([[M, 240], [M + 20, 240]], uOn)}${valve(M + 28, 240, util?.open ?? true, false)}${text(M - 60, 230, "LIMITER 13 MPa", { size: 8, color: util?.open ? COLORS.dim : COLORS.caution })}${red([[M + 36, 240], [M + 36, 420]], uOn)}`);
      const utils: [string, string, number][] = [["GEAR", `${num(lpm(flow("gear")), 1)} L/min`, flow("gear")], ["NWS", `${num(lpm(flow("nws")), 1)} L/min`, flow("nws")], ["SPEEDBRAKES", `${num(surf("speedbrake"))}°`, 0], ["INTAKE RAMPS", `${num(lpm(flow("rampLeft") + flow("rampRight")), 1)} L/min`, flow("rampLeft") + flow("rampRight")]];
      utils.forEach(([n, v, f], i) => { const y = 290 + i * 40; rows.push(`${red([[M + 36, y], [U, y]], f > Q)}${user(U, y, n, v, f > Q)}${grn([[U + 104, y], [R, y]], f > Q)}`); });
      rows.push(text(M - 6, 460, `utilities ${util?.open ? "on" : "ISOLATED"} · ${num(MPa(util?.pressurePa ?? 0), 1)} MPa`, { size: 9, color: util?.open ? COLORS.dim : COLORS.caution }));
    } else {
      // Auto-activation condition (GAF): both systems below 10 MPa (it then needs both engines ≥ 85 %).
      const emerg = h.circuits.every((k) => k.pressurePa < MIG29_HYDRAULICS.lowPressurePa.value);
      rows.push(`${pump(x0 + 70, 230, emerg, 10)}${text(x0 + 84, 226, "EMERG PUMP", { size: 9 })}${text(x0 + 84, 238, "fuel-driven · <10 MPa both", { size: 8, color: COLORS.dim })}${red([[x0 + 70, 220], [x0 + 70, 200], [M, 200]], emerg)}`);
    }
    return `
      <rect x="${x0}" y="6" width="292" height="520" rx="6" fill="${COLORS.panel}" stroke="#44474c"/>
      ${text(x0 + 10, 28, id === "main" ? "MAIN" : "BOOST", { size: 15, weight: 700, color: "#d9b3ff" })}
      ${text(x0 + 282, 28, `${num(p, 1)} MPa`, { size: 15, weight: 700, anchor: "end", color: p < 10 ? COLORS.warn : p < 19 ? COLORS.caution : COLORS.ok })}
      ${text(x0 + 282, 44, `CPI ${num(cpi, 1)} · ${num((c.temperatureK ?? 288) - 273.15)} °C`, { size: 9, anchor: "end", color: COLORS.dim })}
      ${blu([[x0 + 30, 470], [x0 + 30, 92]], pumping)}${pump(x0 + 30, 80, pumping, 12)}${text(x0 + 10, 56, `GBX PUMP ${num(lpm(c.pumpFlowM3s), 0)} L/min`, { size: 9 })}
      ${red([[x0 + 42, 80], [M, 80], [M, id === "main" ? 240 : 200]], pumping || ctrlOn)}
      <rect x="${M - 14}" y="94" width="28" height="22" rx="11" fill="#ff4d7a" opacity="0.8" stroke="${COLORS.line}"/>${text(M + 18, 108, "ACC 8 MPa N₂", { size: 8, color: COLORS.dim })}
      ${rows.join("")}
      ${grn([[R, 120], [R, 480], [x0 + 110, 480]], ctrlOn || pumping)}
      <rect x="${x0 + 10}" y="460" width="100" height="44" rx="16" fill="#0d3a4f" stroke="${BLU}"/>
      <rect x="${x0 + 12}" y="${462 + 40 * (1 - (c.reservoirFraction ?? 1))}" width="96" height="${40 * (c.reservoirFraction ?? 1)}" rx="12" fill="${BLU}" opacity="0.7"/>
      ${text(x0 + 60, 480, "RESERVOIR", { size: 8, anchor: "middle", weight: 700 })}${text(x0 + 60, 494, "in fuel tank 3", { size: 8, anchor: "middle" })}
      ${text(x0 + 130, 512, c.reliefFlowM3s > Q ? "RELIEF 24 MPa OPEN" : "relief 24 MPa", { size: 9, color: c.reliefFlowM3s > Q ? COLORS.caution : COLORS.dim })}`;
  };
  return svg(600, 580, `${system(4, "main")}${system(302, "booster")}
    ${text(12, 544, `GBX driven by the ${g.by} engine (${num(g.v * 100, 1)} %). Warnings below 10 MPa; emergency pump needs both engines ≥ 85 %.`, { size: 9, color: COLORS.dim })}
    ${text(12, 558, "GAF T.O. 1F-MIG29-1. Flows, volumes and thermal values estimated; brakes are pneumatic (not shown).", { size: 9, color: COLORS.dim })}`);
}

export const MIG29_EFB = {
  title: "MiG-29 EFB",
  pages: [
    { id: "engines", title: "Engines", render: (s: Snap) => enginesPage(s) },
    { id: "fuel", title: "Fuel", render: (s: Snap) => fuelPage(s) },
    { id: "electrics", title: "Electrics", render: (s: Snap) => electricsPage(s) },
    { id: "hydraulics", title: "Hydraulics", render: (s: Snap) => hydraulicsPage(s) },
    { id: "pneumatics", title: "Pneumatics", render: (s: Snap) => pneumaticsPage(s) }
  ]
} as const;
