/**
 * F-16C EFB pages (UI only): this aircraft's own systems from its snapshot — the single F110 (GE
 * deck values: N1/N2, EGT), the forward/aft fuel systems with reservoirs and wing tanks, main /
 * standby / EPU generators with PMG, TRs and batteries, and hydraulic systems A/B with the EPU.
 */
import { box, COLORS, engineCutaway, engineHealthPanel, hbar, num, pipe, pump, svg, tank, text, valve } from "../../../app/efb/EfbKit.js";
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

/** Rolling history for the FLCS strip charts (UI state only). */
const history: { tick: number; nzCmd: number; nz: number; pCmd: number; p: number }[] = [];

function chart(x: number, y: number, w: number, h: number, title: string, a: number[], b: number[], lo: number, hi: number, unit: string): string {
  const px = (i: number, n: number) => x + (w * i) / Math.max(1, n - 1);
  const py = (v: number) => y + h - (h * (Math.max(lo, Math.min(hi, v)) - lo)) / (hi - lo);
  const line = (v: number[], color: string, dash = "") => v.length > 1 ? `<polyline points="${v.map((q, i) => `${px(i, v.length).toFixed(1)},${py(q).toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ""}/>` : "";
  const zero = lo < 0 && hi > 0 ? `<line x1="${x}" x2="${x + w}" y1="${py(0)}" y2="${py(0)}" stroke="#555" stroke-dasharray="2 3"/>` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1c1d1f" stroke="#44474c"/>${zero}${line(a, "#f5a524", "5 3")}${line(b, "#7fd4ff")}
    ${text(x + 6, y + 14, title, { size: 10, color: COLORS.dim })}${text(x + w - 6, y + 14, `cmd — dashed · actual — solid (${unit})`, { size: 9, anchor: "end", color: COLORS.dim })}
    ${text(x - 4, y + 10, `${hi}`, { size: 9, anchor: "end", color: COLORS.dim })}${text(x - 4, y + h, `${lo}`, { size: 9, anchor: "end", color: COLORS.dim })}`;
}

function flcsPage(s: Snap): string {
  const t = s.fcsTelemetry, v = (k: string) => t[k] ?? Number.NaN;
  if (Object.keys(t).length === 0) return svg(600, 200, text(20, 40, `FLCS ${s.fcsMode}: no control-law telemetry in this mode`));
  if (!history.length || history[history.length - 1]!.tick !== s.tick) history.push({ tick: s.tick, nzCmd: v("nzCommandG"), nz: v("nzG"), pCmd: v("rollRateCommandDegS"), p: v("rollRateDegS") });
  while (history.length > 100) history.shift();
  const surf = (id: string) => s.surfaces[id] ?? 0;
  const arrow = (x1: number, x2: number, y: number) => `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="#d9d9d9" stroke-width="1.5"/><path d="M${x2 - 6},${y - 4} L${x2},${y} L${x2 - 6},${y + 4} Z" fill="#d9d9d9"/>`;
  const row = (y: number, axis: string, stick: string, cmd: string, meas: string, law: string, lim: string, limState: "on" | "warn" | "shed", surfCmd: string, surfAct: string) => `
    ${text(12, y + 30, axis, { size: 12, weight: 700, color: "#7fd4ff" })}
    ${box(60, y, 82, 52, "STICK", [stick])}${arrow(142, 156, y + 26)}
    ${box(156, y, 100, 52, "COMMAND", [cmd])}${arrow(256, 270, y + 26)}
    <circle cx="284" cy="${y + 26}" r="12" fill="#1c1d1f" stroke="#d9d9d9"/>${text(284, y + 31, "Σ", { anchor: "middle", size: 13 })}${text(284, y + 66, meas, { anchor: "middle", size: 10, color: COLORS.dim })}
    ${arrow(296, 310, y + 26)}${box(310, y, 120, 52, law, [lim], limState)}${arrow(430, 444, y + 26)}
    ${box(444, y, 140, 52, "SURFACE", [surfCmd, surfAct])}`;
  const limitingRoll = v("rollRateLimitDegS") < 307.9;
  const hist = (k: "nzCmd" | "nz" | "pCmd" | "p") => history.map((h) => h[k]);
  return svg(600, 640, `
    ${text(12, 22, `FLCS ${s.fcsMode} · q̄ ${num(v("dynamicPressureKPa"), 1)} kPa · α ${num(v("alphaDeg"), 1)}° · β ${num(v("betaDeg"), 1)}°`, { size: 12 })}
    ${v("spinPrevention") ? text(588, 22, "SPIN PREVENTION", { size: 12, anchor: "end", color: COLORS.warn, weight: 700 }) : ""}
    ${row(40, "PITCH", `${num(v("stickPitch") * 100)} %`, `${num(v("nzCommandG"), 2)} g`, `nz ${num(v("nzG"), 2)} g · q ${num(v("pitchRateDegS"), 1)}°/s`, "g / AoA LIMIT",
      v("alphaLimiting") ? `AOA LIMITING (α ${num(v("alphaDeg"), 1)}°)` : "within limits", v("alphaLimiting") ? "warn" : "on", `cmd ${num(v("stabCmdDeg"), 1)}°`, `stab ${num(surf("elevator"), 1)}°`)}
    ${row(140, "ROLL", `${num(v("stickRoll") * 100)} %`, `${num(v("rollRateCommandDegS"), 0)}°/s`, `p ${num(v("rollRateDegS"), 0)}°/s`, "ROLL LIMITER",
      `max ${num(v("rollRateLimitDegS"), 0)}°/s`, limitingRoll ? "shed" : "on", `cmd ${num(v("flaperonCmdDeg"), 1)}°`, `flprn ${num(surf("aileron"), 1)}°`)}
    ${row(240, "YAW", `${num(v("pedals") * 100)} %`, "β · r FB", `r ${num(v("yawRateDegS"), 1)}°/s · ny ${num(v("nyG"), 2)} g`, "ARI + DAMPER",
      "ARI active", "on", `cmd ${num(v("rudderCmdDeg"), 1)}°`, `rud ${num(surf("rudder"), 1)}°`)}
    ${chart(40, 350, 540, 120, "Nz (g)", hist("nzCmd"), hist("nz"), -2, 9, "g")}
    ${chart(40, 490, 540, 120, "Roll rate (°/s)", hist("pCmd"), hist("p"), -320, 320, "°/s")}
    ${text(12, 632, "Control laws: NASA TP-1538 (F-16 simulator FLCS), not the production Block 50 OFP.", { size: 9, color: COLORS.dim })}`);
}

function healthPage(s: Snap): string {
  const e = s.engines[0];
  return svg(600, 450, `${e ? engineHealthPanel(150, 14, 300, e, "F110-GE-129") : ""}
    ${text(10, 446, "Transient, stall-margin, oil and augmentor-zone values estimated (no F110 data in the project).", { size: 9, color: COLORS.dim })}`);
}

export const F16_EFB = {
  title: "F-16C EFB",
  pages: [
    { id: "engine", title: "Engine", render: (s: Snap) => enginePage(s) },
    { id: "health", title: "Eng Health", render: (s: Snap) => healthPage(s) },
    { id: "flcs", title: "FLCS", render: (s: Snap) => flcsPage(s) },
    { id: "fuel", title: "Fuel", render: (s: Snap, p: Snap | undefined) => fuelPage(s, p) },
    { id: "electrics", title: "Electrics", render: (s: Snap) => electricsPage(s) },
    { id: "hydraulics", title: "Hydraulics", render: (s: Snap) => hydraulicsPage(s) }
  ]
} as const;
