/**
 * F-16C EFB pages (UI only): this aircraft's own systems from its snapshot — the single F110 (GE
 * deck values: N1/N2, EGT), the forward/aft fuel systems with reservoirs and wing tanks, main /
 * standby / EPU generators with PMG, TRs and batteries, and hydraulic systems A/B with the EPU.
 */
import { box, COLORS, engineCutaway, hbar, num, pipe, pump, svg, tank, text, valve } from "../../../app/efb/EfbKit.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { F16_HYDRAULICS } from "./F16Data.js";

type Snap = AircraftSnapshot;
const LB = 0.45359237;
const kg = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.kg ?? 0;
const cap = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.capacityKg ?? 1;
const falling = (s: Snap, p: Snap | undefined, id: string) => !!p && kg(p, id) - kg(s, id) > 0.05;
const lb = (k: number) => `${(k / LB).toFixed(0)}`;

function enginePage(s: Snap): string {
  const e = s.engines[0];
  if (!e) return svg(600, 200, text(20, 40, "No engine"));
  return svg(600, 690, `
    ${tank(250, 14, 100, 50, kg(s, "fwdReservoir") + kg(s, "aftReservoir"), cap(s, "fwdReservoir") + cap(s, "aftReservoir"), "RESERVOIRS", { unit: lb })}
    ${pump(268, 58, e.fuelFlowKgS > 0, 7)}${pump(332, 58, e.fuelFlowKgS > 0, 7)}
    ${pipe([[300, 64], [300, 100], [250, 100], [250, 150]], { flow: e.fuelFlowKgS > 0 })}
    ${engineCutaway(250, 150, e, "right", `N2 ${num(e.n2Rpm)} rpm`)}
    ${text(40, 180, `N1 ${num(e.n1Rpm)} rpm`, { size: 13, weight: 600 })}
    ${text(40, 200, `EGT ${e.exhaustGasTemperatureK !== undefined ? (e.exhaustGasTemperatureK - 273.15).toFixed(0) + "°C" : "—"}`, { size: 13, weight: 600 })}
    ${text(40, 220, `FTIT n/a in deck`, { size: 10, color: COLORS.dim })}
    ${text(40, 260, `ENG CONT ${e.control.mode === "backup" ? "SEC" : "PRI"}`, { size: 13, color: e.control.mode === "backup" ? COLORS.caution : COLORS.ok, weight: 600 })}
    ${text(40, 280, e.control.activeLimits.join(", ") || "no limiter", { size: 10, color: COLORS.dim })}
    ${text(40, 320, `${num(e.netThrustN / 4.4482216)} lbf`, { size: 16, weight: 700 })}
    ${text(40, 340, `${num(e.fuelFlowKgS * 3600 / LB)} PPH`, { size: 13 })}
    ${e.outsideDeck ? text(40, 370, "OUTSIDE ENGINE DECK", { size: 11, color: COLORS.caution }) : ""}`);
}

function fuelPage(s: Snap, p: Snap | undefined): string {
  const ff = s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600 / LB;
  const t = (id: string, x: number, y: number, w: number, h: number, label: string, shape?: string) => tank(x, y, w, h, kg(s, id), cap(s, id), label, { unit: lb, active: falling(s, p, id), ...(shape ? { shape } : {}) });
  const fwd = kg(s, "f1") + kg(s, "fwdReservoir"), aft = kg(s, "a1") + kg(s, "aftReservoir");
  return svg(600, 690, `
    ${text(24, 40, `${(s.fuelKg / LB).toFixed(0)} lb`, { size: 22 })}
    ${text(24, 70, `${ff.toFixed(0)} PPH`, { size: 16 })}
    ${text(24, 100, `FWD ${lb(fwd)}  AFT ${lb(aft)}`, { size: 12 })}
    ${text(24, 118, `imbalance ${lb(Math.abs(fwd - aft))} lb`, { size: 11, color: COLORS.dim })}
    ${t("f1", 240, 70, 120, 130, "F-1 (FWD)")}${t("fwdReservoir", 255, 220, 90, 60, "FWD RES")}${pump(273, 270, falling(s, p, "fwdReservoir") || ff > 0, 7)}
    ${t("aftReservoir", 255, 300, 90, 60, "AFT RES")}${pump(327, 350, ff > 0, 7)}${t("a1", 240, 380, 120, 120, "A-1 (AFT)")}
    ${t("wingL", 60, 230, 165, 90, "L WING", "M60,260 L225,230 L225,290 L80,320 Z")}${t("wingR", 375, 230, 165, 90, "R WING", "M540,260 L375,230 L375,290 L520,320 Z")}
    ${pipe([[300, 200], [300, 220]], { flow: falling(s, p, "f1") })}${pipe([[300, 360], [300, 380]], { flow: falling(s, p, "a1") })}
    ${pipe([[225, 255], [232, 255], [232, 120], [240, 120]], { flow: falling(s, p, "wingL") })}${pipe([[375, 275], [368, 275], [368, 440], [360, 440]], { flow: falling(s, p, "wingR") })}
    ${pipe([[345, 250], [430, 250], [430, 560], [300, 560], [300, 640]], { flow: ff > 0 })}${pipe([[345, 330], [430, 330]], { flow: ff > 0 })}
    ${valve(300, 600, true)}${text(300, 664, "ENGINE FEED", { anchor: "middle", size: 11 })}
    ${text(24, 640, `CG ${(s.cgFractionMac * 100).toFixed(1)} % MAC`, { size: 13 })}`);
}

function electricsPage(s: Snap): string {
  const el = s.electrical;
  if (!el) return svg(600, 200, text(20, 40, "No electrical model"));
  const src = (id: string) => el.sources.find((x) => x.id === id)!;
  const bus = (id: string) => el.buses.find((x) => x.id === id)!;
  const gen = (x: number, y: number, id: string, name: string) => { const o = src(id); return box(x, y, 150, 58, name, [o.tripped ? "TRIPPED" : o.online ? "ONLINE" : "OFF", `${(o.loadW / 1000).toFixed(1)} kVA`], o.tripped ? "warn" : o.online ? "on" : "off"); };
  const busBox = (x: number, y: number, id: string, name: string, v: number) => { const b = bus(id); return box(x, y, 180, 58, name, [b.powered ? `from ${b.sourceId}` : "UNPOWERED", `${v} V · ${(b.loadW / v).toFixed(1)} A${b.shed ? " · SHED" : ""}`], !b.powered ? "warn" : b.shed ? "shed" : "on", v > 100 ? "#ff9b9b" : "#9bb0ff"); };
  const epu = s.hydraulics?.emergencyUnit;
  return svg(600, 600, `
    ${gen(20, 20, "gen.main", "MAIN GEN 60 kVA")}${gen(225, 20, "gen.standby", "STBY GEN 10 kVA")}${gen(430, 20, "gen.epu", "EPU GEN 5 kVA")}
    ${pipe([[95, 78], [95, 150]], { flow: src("gen.main").online, color: COLORS.elec, fluid: "#ffb3b3" })}${pipe([[300, 78], [300, 250]], { flow: src("gen.standby").online, color: COLORS.elec, fluid: "#ffb3b3" })}${pipe([[505, 78], [505, 250], [390, 250]], { flow: src("gen.epu").online, color: COLORS.elec, fluid: "#ffb3b3" })}
    ${busBox(10, 150, "ac.nonessential", "AC NON-ESS", 115)}${busBox(210, 250, "ac.essential", "AC ESSENTIAL", 115)}
    ${box(210, 345, 180, 46, "TR", [src("tr").online ? `${(src("tr").loadW / 1000).toFixed(1)} kW` : "off"], src("tr").online ? "on" : "off", "#9bb0ff")}
    ${pipe([[300, 308], [300, 345]], { flow: src("tr").online, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${busBox(210, 420, "dc.essential", "DC ESSENTIAL", 28)}${pipe([[300, 391], [300, 420]], { flow: bus("dc.essential").powered, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${box(420, 420, 160, 58, "MAIN BATTERY", [`${num(src("battery.main").chargeAh, 1)} Ah`, src("battery.main").online ? "DISCHARGING" : "standby"], src("battery.main").online ? "shed" : "on", "#8fe28f")}
    ${busBox(10, 520, "flcs", "FLCS POWER", 28)}
    ${box(210, 520, 120, 58, "FLCS PMG", [src("pmg").online ? "ONLINE" : "OFF"], src("pmg").online ? "on" : "warn", "#8fe28f")}
    ${box(345, 520, 120, 58, "FLCS BATT", [`${num(src("battery.flcs").chargeAh, 1)} Ah`], src("battery.flcs").online ? "shed" : "on", "#8fe28f")}
    ${text(20, 120, `EPU ${epu ? epu.state.toUpperCase() : "—"}${epu && epu.state !== "off" ? ` · ${epu.remainingS.toFixed(0)} s` : ""}`, { size: 12, color: epu && epu.state !== "off" ? COLORS.caution : COLORS.dim })}`);
}

function hydraulicsPage(s: Snap): string {
  const h = s.hydraulics;
  if (!h) return svg(600, 200, text(20, 40, "No hydraulic model"));
  const nom = F16_HYDRAULICS.nominalPressurePa.value;
  const circ = (x: number, id: string, name: string) => {
    const c = h.circuits.find((k) => k.id === id)!, f = c.pressurePa / nom;
    return `${box(x, 40, 230, 110, name, [`${(c.pressurePa / 6894.76).toFixed(0)} psi`, `pump ${(c.pumpFlowM3s * 15850).toFixed(1)} gpm`, `demand ${(c.demandFlowM3s * 15850).toFixed(1)} gpm`, `FLCS acc ${(c.accumulatorFluidM3 * 1000).toFixed(2)} L`], f < 0.33 ? "warn" : "on", "#d9b3ff")}
      ${hbar(x + 10, 170, 210, "PRESSURE (0–4000 psi)", c.pressurePa / (4000 * 6894.76), `${(c.pressurePa / 6894.76).toFixed(0)}`, f < 0.33 ? COLORS.warn : f < 0.9 ? COLORS.caution : COLORS.ok)}`;
  };
  const e = s.engines[0], epu = h.emergencyUnit;
  const engPump = (e?.spoolSpeed ?? 0) > 0.3;
  return svg(600, 480, `
    ${circ(20, "A", "SYSTEM A")}${circ(350, "B", "SYSTEM B")}${pump(135, 220, engPump)}${pump(465, 220, engPump)}
    ${pipe([[135, 229], [135, 270], [300, 270]], { flow: engPump, color: COLORS.hyd, fluid: "#e9d5ff" })}${pipe([[465, 229], [465, 270], [300, 270]], { flow: engPump, color: COLORS.hyd, fluid: "#e9d5ff" })}
    ${box(200, 270, 200, 90, "FLIGHT CONTROLS", ["stabilators · flaperons", "rudder · LEF", "A + B (one chamber each)"], "on", "#d9b3ff")}
    ${box(20, 270, 160, 74, "EPU PUMP → A", [epu ? epu.state.toUpperCase() : "—", epu ? `${epu.remainingS.toFixed(0)} s fuel` : ""], epu && epu.state === "running" ? "shed" : "off", "#d9b3ff")}
    ${box(420, 270, 160, 74, "UTILITIES (B)", ["gear · brakes", "NWS · speedbrake (A)"], "on", "#d9b3ff")}
    ${text(20, 400, "Pumps on the engine accessory drive gearbox; EPU auto-starts on dual low pressure or loss of both generators.", { size: 10, color: COLORS.dim })}`);
}

export const F16_EFB = {
  title: "F-16C EFB",
  pages: [
    { id: "engine", title: "Engine", render: (s: Snap) => enginePage(s) },
    { id: "fuel", title: "Fuel", render: (s: Snap, p: Snap | undefined) => fuelPage(s, p) },
    { id: "electrics", title: "Electrics", render: (s: Snap) => electricsPage(s) },
    { id: "hydraulics", title: "Hydraulics", render: (s: Snap) => hydraulicsPage(s) }
  ]
} as const;
