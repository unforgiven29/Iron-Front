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

const ind = (s: Snap, k: string) => s.indications[k] ?? Number.NaN;
const fi = (s: Snap, k: string) => s.fuelComponents?.indications?.[k] ?? Number.NaN;
const pumpRunning = (s: Snap, id: string) => s.fuelComponents?.pumps.find((p) => p.id === id)?.running ?? false;
const valveOpen = (s: Snap, id: string) => s.fuelComponents?.valves.find((v) => v.id === id)?.open ?? false;
const flowKgS = (s: Snap, from: string, to: string) => s.fuelComponents?.flows.filter((f) => f.from === from && f.to === to).reduce((a, f) => a + f.kgS, 0) ?? 0;

/** Round cockpit-style gauge (needle over an arc), value from the systems monitor. */
function gauge(cx: number, cy: number, label: string, v: number, lo: number, hi: number, fmt: string, red?: number): string {
  const f = Number.isFinite(v) ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
  const ang = (-225 + 270 * f) * Math.PI / 180, r = 34;
  const redArc = red !== undefined ? (() => { const fr = (red - lo) / (hi - lo), a0 = (-225 + 270 * fr) * Math.PI / 180, a1 = 45 * Math.PI / 180;
    return `<path d="M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${fr < 0.33 ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}" stroke="${COLORS.warn}" stroke-width="4" fill="none"/>`; })() : "";
  return `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#111" stroke="#555"/>
    <path d="M${cx + r * Math.cos(-225 * Math.PI / 180)},${cy + r * Math.sin(-225 * Math.PI / 180)} A${r},${r} 0 1 1 ${cx + r * Math.cos(45 * Math.PI / 180)},${cy + r * Math.sin(45 * Math.PI / 180)}" stroke="#666" stroke-width="2" fill="none"/>${redArc}
    <line x1="${cx}" y1="${cy}" x2="${cx + (r - 4) * Math.cos(ang)}" y2="${cy + (r - 4) * Math.sin(ang)}" stroke="#f4f4f4" stroke-width="2.5"/>
    ${text(cx, cy + 22, fmt, { anchor: "middle", size: 11, weight: 700 })}${text(cx, cy + 56, label, { anchor: "middle", size: 10, color: COLORS.dim })}`;
}

function lightsRow(s: Snap, x: number, y: number): string {
  const all = ["ENGINE", "HYD/OIL PRESS", "FWD FUEL LOW", "AFT FUEL LOW", "FUEL/OIL HOT", "SEC", "ELEC SYS", "GRAVITY FEED"];
  const on = new Set(s.lights.map((l) => l.text));
  return all.map((t, i) => { const lv = s.lights.find((l) => l.text === t)?.level; const col = !on.has(t) ? "#2a2c2f" : lv === "warning" ? "#a31515" : "#a86a00";
    return `<rect x="${x + (i % 4) * 146}" y="${y + Math.floor(i / 4) * 30}" width="140" height="24" rx="3" fill="${col}" stroke="#555"/>${text(x + (i % 4) * 146 + 70, y + Math.floor(i / 4) * 30 + 16, t, { anchor: "middle", size: 10, weight: 700, color: on.has(t) ? "#fff" : "#666" })}`; }).join("");
}

function enginePage(s: Snap): string {
  const e = s.engines[0];
  if (!e) return svg(600, 200, text(20, 40, "No engine"));
  const st = e.stations, sec = e.control.mode === "backup";
  const igv = ind(s, "igvClosedFraction"), vsv = ind(s, "vsvResetS");
  return svg(600, 1310, `
    ${text(16, 24, "COCKPIT ENGINE INSTRUMENTS (T.O. GR1F-16CJ-1, GE 129)", { size: 11, color: COLORS.dim })}
    ${gauge(70, 80, "RPM %", ind(s, "rpmPercent"), 0, 110, `${num(ind(s, "rpmPercent"))}`)}
    ${gauge(185, 80, "FTIT °C", ind(s, "ftitC"), 200, 1200, `${num(ind(s, "ftitC"))}`, 980)}
    ${gauge(300, 80, "NOZ POS %", ind(s, "nozzlePercent"), 0, 100, `${num(ind(s, "nozzlePercent"))}`)}
    ${gauge(415, 80, "OIL psi", ind(s, "oilPsi"), 0, 100, `${num(ind(s, "oilPsi"))}`, 65)}
    <rect x="480" y="56" width="104" height="44" rx="4" fill="#111" stroke="#555"/>${text(532, 85, `${num(ind(s, "fuelFlowPph"))}`, { anchor: "middle", size: 16, weight: 700 })}${text(532, 136, "FUEL FLOW pph", { anchor: "middle", size: 10, color: COLORS.dim })}
    ${lightsRow(s, 16, 160)}
    ${tank(250, 232, 100, 44, kg(s, "fwdReservoir") + kg(s, "aftReservoir"), cap(s, "fwdReservoir") + cap(s, "aftReservoir"), "RESERVOIRS", { unit: lb })}
    ${pipe([[300, 276], [300, 300], [250, 300], [250, 330]], { flow: e.fuelFlowKgS > 0 })}
    ${engineCutaway(250, 330, e, "right", `N2 ${num(e.n2Rpm)} rpm`)}
    ${box(16, 330, 170, 132, sec ? "SEC (MEC)" : "DEC (PRI)", [
      sec ? "MEC: fuel" : "fuel·nozzle·IGV·AB",
      `IGV ${Number.isFinite(igv) ? (igv >= 0.99 ? "CLOSED" : igv <= 0.01 ? "OPEN" : `${num((1 - igv) * 100)} % open`) : "—"}${sec ? " (fixed)" : ""}`,
      `VSV ${vsv > 0 ? `RESET ${num(vsv)} s` : "normal schedule"}`,
      `IGN ${ind(s, "highEnergyIgnition") ? "HIGH ENERGY" : ind(s, "lowEnergyIgnition") ? "LOW ENERGY" : "off"}`,
      `AB ${sec ? "INHIBITED" : e.afterburnerLit ? `${e.afterburnerZonesLit}/${e.afterburnerZones} zones` : "off"}`
    ], sec ? "shed" : "on")}
    ${box(16, 476, 170, 74, "FUEL TO ENGINE", [`${num(fi(s, "feedFuelTemperatureK") - 273.15)} °C after HX`, `main valve ${num(fi(s, "mainValvePosition") * 100)} %`, fi(s, "ffpRunning") ? "FFP running (HYD A)" : "FFP BYPASS"], fi(s, "fuelHot") ? "warn" : "on")}
    ${text(16, 772, `${num(e.netThrustN / 4.4482216)} lbf`, { size: 16, weight: 700 })}
    ${text(200, 772, `N1 ${num(e.n1Rpm)} rpm · ${e.control.activeLimits.join(", ") || "no limiter"}`, { size: 10, color: COLORS.dim })}
    ${st ? text(16, 794, `P3/P2 ${num(st.pt3Pa / st.pt2Pa, 1)} · BPR ${num(st.bypassRatio, 2)} · main ${num(st.mainFuelKgS * 3600 / LB)} pph f/a ${num(st.fuelAirRatio, 4)} · AB ${num(st.afterburnerFuelKgS * 3600 / LB)} pph`, { size: 10 }) : ""}
    ${e.outsideDeck ? text(16, 812, "OUTSIDE ENGINE DECK", { size: 11, color: COLORS.caution }) : ""}
    ${text(16, 836, "ENGINE HEALTH", { size: 13, weight: 700, color: "#7fd4ff" })}
    ${engineHealthPanel(150, 846, 300, e, "F110-GE-129", { oilPressMinPa: 15 * 6894.757 })}
    ${text(16, 1284, "Limits (fig 5-2): FTIT 980 °C MIL/AB, 935 start; RPM 108 % (109 transient); oil 25–65 psi MIL, 15 min idle.", { size: 9, color: COLORS.dim })}
    ${text(16, 1298, "ENGINE: RPM < 60 % or FTIT > 1,100 °C 2 s. HYD/OIL: oil < 10 psi 30 s. IGV schedule estimated.", { size: 9, color: COLORS.dim })}`);
}

function fuelPage(s: Snap, p: Snap | undefined): string {
  const t = (id: string, x: number, y: number, w: number, h: number, label: string, shape?: string) => tank(x, y, w, h, kg(s, id), cap(s, id), label, { unit: lb, active: falling(s, p, id), ...(shape ? { shape } : {}) });
  const fwd = kg(s, "f1") + kg(s, "f2") + kg(s, "fwdReservoir"), aft = kg(s, "a1") + kg(s, "aftReservoir");
  const imbalance = fwd < aft; // C: red AL pointer when FR < AL
  const sw = (id: string) => s.switches[id] ?? "—";
  const fl = (a: string, b: string) => flowKgS(s, a, b) > 1e-3;
  const pumpLabel = (x: number, y: number, id: string, name: string) => `${pump(x, y, pumpRunning(s, id), 8)}${text(x + 12, y + 4, name, { size: 9, color: COLORS.dim })}`;
  const ff = s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600 / LB;
  return svg(600, 860, `
    ${text(16, 30, `TOTAL ${lb(s.fuelKg)} lb`, { size: 20, weight: 700 })}${text(16, 54, `${num(ff)} pph`, { size: 14 })}
    ${text(16, 78, `FR (fwd) ${lb(fwd)} · AL (aft) ${lb(aft)}`, { size: 12, color: imbalance ? COLORS.warn : COLORS.text })}
    ${text(16, 96, imbalance ? "IMBALANCE — red AL pointer" : `fwd heavy ${lb(fwd - aft)} lb`, { size: 11, color: imbalance ? COLORS.warn : COLORS.dim })}
    ${box(400, 12, 190, 104, "FUEL CONTROL", [`FUEL MASTER ${sw("f16.fuel.master")}`, `ENG FEED ${sw("f16.fuel.eng-feed")}`, `QTY SEL ${sw("f16.fuel.qty-sel")}`, `AIR REFUEL ${sw("f16.fuel.air-refuel")}`, `INERTING ${sw("f16.fuel.tank-inerting")}`], "on")}
    ${text(300, 136, "FORWARD SYSTEM", { anchor: "middle", size: 10, color: COLORS.dim })}
    ${t("f1", 240, 142, 120, 90, "F-1")}${pumpLabel(372, 190, "xfer.f1", "XFER")}
    ${t("f2", 240, 252, 120, 80, "F-2")}
    ${t("fwdReservoir", 255, 352, 90, 56, "FWD RSVR")}${pumpLabel(372, 384, "boost.fwd", "BOOST")}${text(372, 404, pumpRunning(s, "ejector.fwd") ? "ejector ON" : "", { size: 9, color: COLORS.dim })}
    ${t("aftReservoir", 255, 448, 90, 56, "AFT RSVR")}${pumpLabel(372, 480, "boost.aft", "BOOST")}${text(372, 500, pumpRunning(s, "ejector.aft") ? "ejector ON" : "", { size: 9, color: COLORS.dim })}
    ${t("a1", 240, 524, 120, 110, "A-1")}${pumpLabel(372, 580, "xfer.a1", "XFER")}
    ${text(300, 650, "AFT SYSTEM", { anchor: "middle", size: 10, color: COLORS.dim })}
    ${t("wingR", 420, 240, 160, 80, "R WING (fwd sys)", "M580,270 L420,240 L420,300 L560,320 Z")}${pumpLabel(470, 336, "xfer.wingR", "XFER")}
    ${t("wingL", 20, 500, 160, 80, "L WING (aft sys)", "M20,530 L180,500 L180,560 L40,580 Z")}
    ${pipe([[420, 285], [380, 285], [380, 292], [360, 292]], { flow: fl("wingR", "f2") })}
    ${pipe([[300, 232], [300, 252]], { flow: fl("f1", "f2") })}${pipe([[300, 332], [300, 352]], { flow: fl("f2", "fwdReservoir") })}
    ${pipe([[180, 545], [210, 545], [210, 580], [240, 580]], { flow: fl("wingL", "a1") })}${pipe([[300, 524], [300, 504]], { flow: fl("a1", "aftReservoir") })}
    ${pipe([[240, 560], [200, 560], [200, 300], [240, 300]], { flow: fl("a1", "f2") })}${valve(200, 430, valveOpen(s, "trim"))}${text(150, 434, "TRIM", { size: 9, color: COLORS.dim })}
    ${pipe([[255, 380], [220, 380], [220, 476], [255, 476]], { flow: fl("aftReservoir", "f2") || fl("fwdReservoir", "a1") })}${valve(220, 428, valveOpen(s, "crossfeed"))}${text(226, 450, "XFEED", { size: 9, color: COLORS.dim })}
    ${pipe([[345, 380], [440, 380], [440, 690]], { flow: fl("fwdReservoir", "f110") })}${pipe([[345, 476], [440, 476]], { flow: fl("aftReservoir", "f110") })}
    ${box(380, 690, 120, 50, "FFP (HYD A)", [pumpRunning(s, "ffp") ? "PROPORTIONING" : "BYPASS"], pumpRunning(s, "ffp") ? "on" : "shed")}
    ${pipe([[440, 740], [440, 760], [300, 760]], { flow: ff > 0 })}
    ${box(170, 740, 130, 50, "FUEL/OIL HX", [`${num(fi(s, "feedFuelTemperatureK") - 273.15)} °C`], fi(s, "fuelHot") ? "warn" : "on")}
    ${pipe([[170, 765], [110, 765], [110, 800]], { flow: ff > 0 })}${valve(110, 812, valveOpen(s, "mainShutoff"))}${text(124, 816, `MAIN S/O ${num(fi(s, "mainValvePosition") * 100)} %`, { size: 9 })}
    ${text(20, 848, `→ F110  ·  tanks ${num(fi(s, "tankFuelTemperatureK") - 273.15)} °C  ·  CG ${num(s.cgFractionMac * 100, 1)} % MAC  ·  auto fwd transfer ${fi(s, "autoTransferArmed") ? "ARMED" : "off"}${fi(s, "gravityFeed") ? "  ·  GRAVITY FEED" : ""}`, { size: 10 })}`);
}

function electricsPage(s: Snap): string {
  const el = s.electrical;
  if (!el) return svg(600, 200, text(20, 40, "No electrical model"));
  const src = (id: string) => el.sources.find((x) => x.id === id);
  const bus = (id: string) => el.buses.find((x) => x.id === id);
  const gen = (x: number, y: number, id: string, name: string) => { const o = src(id); if (!o) return ""; return box(x, y, 140, 58, name, [o.tripped ? "TRIPPED" : o.online ? "ON LINE" : o.available ? "AVAILABLE" : "OFF", `${(o.loadW / 1000).toFixed(1)} kVA`], o.tripped ? "warn" : o.online ? "on" : o.available ? "shed" : "off"); };
  const NAMES: Record<string, string> = { "gen.main": "main gen", "gen.standby": "standby gen", "gen.epu": "EPU gen", "pmg.flcs": "FLCS PMG", "pmg.epu": "EPU PMG", "battery.main": "BATTERY", "conv.flcs": "conv/reg ← EM DC", "conv.dc.nonessential": "converter", "conv.dc.essential": "converter", "conv.dc.emergency1": "converter", "conv.dc.emergency2": "converter" };
  const busBox = (x: number, y: number, id: string, name: string, ac: boolean) => { const b = bus(id); if (!b) return ""; return box(x, y, 134, 50, name, [b.powered ? `← ${NAMES[b.sourceId ?? ""] ?? b.sourceId}` : "UNPOWERED"], !b.powered ? "warn" : "on", ac ? "#ff9b9b" : "#9bb0ff"); };
  const light = (x: number, y: number, k: string, label: string) => { const on = (s.indications[k] ?? 0) > 0; return `<rect x="${x}" y="${y}" width="96" height="22" rx="3" fill="${on ? "#a86a00" : "#2a2c2f"}" stroke="#555"/>${text(x + 48, y + 15, label, { anchor: "middle", size: 9, weight: 700, color: on ? "#fff" : "#666" })}`; };
  const epu = s.hydraulics?.emergencyUnit;
  return svg(600, 700, `
    ${light(12, 10, "elecFlcsPmg", "FLCS PMG")}${light(112, 10, "elecMainGen", "MAIN GEN")}${light(212, 10, "elecStbyGen", "STBY GEN")}${light(312, 10, "elecEpuGen", "EPU GEN")}${light(412, 10, "elecBattToFlcs", "ACFT BATT TO FLCS")}
    ${gen(12, 44, "gen.main", "MAIN GEN 60 kVA")}${gen(160, 44, "gen.standby", "STBY GEN 10 kVA")}${gen(308, 44, "gen.epu", "EPU GEN 5 kVA")}${gen(456, 44, "pmg.flcs", "FLCS PMG")}
    ${text(12, 124, "AC BUSES", { size: 11, color: COLORS.dim })}
    ${busBox(12, 130, "ac.nonessential", "NON-ESS AC", true)}${busBox(158, 130, "ac.essential", "ESSENTIAL AC", true)}${busBox(304, 130, "ac.emergency1", "EMERG AC 1", true)}${busBox(450, 130, "ac.emergency2", "EMERG AC 2", true)}
    ${pipe([[79, 180], [79, 240]], { flow: !!bus("dc.nonessential")?.powered, color: COLORS.dc, fluid: "#b3c4ff" })}${pipe([[225, 180], [225, 240]], { flow: !!bus("dc.essential")?.powered, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${pipe([[371, 180], [371, 240]], { flow: !!bus("dc.emergency1")?.powered, color: COLORS.dc, fluid: "#b3c4ff" })}${pipe([[517, 180], [517, 240]], { flow: !!bus("dc.emergency2")?.powered, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${text(12, 214, "AC→DC converters", { size: 9, color: COLORS.dim })}
    ${text(12, 236, "DC BUSES", { size: 11, color: COLORS.dim })}
    ${busBox(12, 242, "dc.nonessential", "NON-ESS DC", false)}${busBox(158, 242, "dc.essential", "ESSENTIAL DC", false)}${busBox(304, 242, "dc.emergency1", "EMERG DC 1", false)}${busBox(450, 242, "dc.emergency2", "EMERG DC 2", false)}
    ${busBox(304, 312, "dc.battery1", "BATTERY BUS 1", false)}${busBox(450, 312, "dc.battery2", "BATTERY BUS 2", false)}
    ${box(12, 312, 280, 50, "AIRCRAFT BATTERY", [`${num(src("battery.main")?.chargeAh ?? 0, 1)} Ah · ${src("battery.main")?.online ? "DISCHARGING" : "charging / standby"}`], src("battery.main")?.online ? "shed" : "on", "#8fe28f")}
    ${busBox(12, 392, "flcs", "FLCS POWER (A–D)", false)}
    ${box(158, 392, 280, 50, "FLCS CONVERTER/REGULATORS", ["PMG · EPU PMG · EMERG DC · ACFT BATT"], "on", "#8fe28f")}
    ${text(12, 472, `EPU ${epu ? epu.state.toUpperCase() : "—"}${epu && epu.state !== "off" ? ` · ${epu.remainingS.toFixed(0)} s hydrazine` : ""}`, { size: 12, color: epu && epu.state !== "off" ? COLORS.caution : COLORS.dim })}
    ${text(12, 500, "Loads on each bus (manual figs 1-31/1-32):", { size: 10, color: COLORS.dim })}
    ${["Non-ess DC: fuel pumps 1, 2, 4 · FCR · ECM", "Essential DC: fuel pumps 3, 5 · radar altimeter · stations", "Emerg DC 1: FUEL LOW lights · FLCS A/B · INS · TACAN · speedbrakes", "Emerg DC 2: auto fwd fuel transfer · HUD · FLCS C/D · gear command",
      "Battery 1: ENGINE, HYD/OIL PRESS lights · FTIT, RPM gauges · JFS", "Battery 2: DEC · FUEL MASTER · ELEC SYS caution",
      "Main gen → all buses · standby → all but non-ess · EPU → emergency + battery only"].map((l, i) => text(12, 518 + i * 16, l, { size: 10, color: i === 6 ? COLORS.text : COLORS.dim })).join("")}
    ${text(12, 690, "T.O. GR1F-16CJ-1 Section I. Loads, battery capacity and converter ratings estimated; FLCS branches lumped.", { size: 9, color: COLORS.dim })}`);
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
  return svg(600, 520, `
    ${circ(20, "A", "SYSTEM A")}${circ(350, "B", "SYSTEM B")}${pump(135, 220, engPump)}${pump(465, 220, engPump)}
    ${pipe([[135, 229], [135, 270], [300, 270]], { flow: engPump, color: COLORS.hyd, fluid: "#e9d5ff" })}${pipe([[465, 229], [465, 270], [300, 270]], { flow: engPump, color: COLORS.hyd, fluid: "#e9d5ff" })}
    ${box(200, 270, 200, 90, "FLIGHT CONTROLS", ["stabilators · flaperons", "rudder · LEF", "A + B (one chamber each)"], "on", "#d9b3ff")}
    ${box(20, 270, 160, 74, "EPU PUMP → A", [epu ? epu.state.toUpperCase() : "—", epu ? `${epu.remainingS.toFixed(0)} s fuel` : ""], epu && epu.state === "running" ? "shed" : "off", "#d9b3ff")}
    ${box(420, 270, 160, 90, "UTILITIES (B)", ["LG · brakes · NWS", "gun · AR door/latch", "brake/JFS accumulators"], "on", "#d9b3ff")}
    ${box(20, 360, 160, 74, "SYS A ONLY", ["speedbrakes", "fuel flow proportioner"], "on", "#d9b3ff")}
    ${hbar(420, 380, 160, "BRAKE/JFS ACC", (s.indications["brakeJfsAccumulatorCharge"] ?? 0), `${num(s.indications["brakeJfsAccumulatorPsi"] ?? 0)} psi`, (s.indications["brakeJfsAccumulatorCharge"] ?? 0) < 0.3 ? COLORS.caution : COLORS.ok)}
    ${["3,000 psi systems A and B on the ADG; HYD/OIL PRESS below 1,000 psi.", "Both feed the FLCS and LEFs (reduced rate on one system).", "EPU pump → A on dual low pressure or loss of both generators.", "B charges the brake/JFS accumulators above 12 % rpm (40–60 s)."].map((l, i) => text(20, 452 + i * 15, l, { size: 10, color: COLORS.dim })).join("")}`);
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


export const F16_EFB = {
  title: "F-16C EFB",
  pages: [
    { id: "engine", title: "Engine", render: (s: Snap) => enginePage(s) },
    { id: "flcs", title: "FLCS", render: (s: Snap) => flcsPage(s) },
    { id: "fuel", title: "Fuel", render: (s: Snap, p: Snap | undefined) => fuelPage(s, p) },
    { id: "electrics", title: "Electrics", render: (s: Snap) => electricsPage(s) },
    { id: "hydraulics", title: "Hydraulics", render: (s: Snap) => hydraulicsPage(s) }
  ]
} as const;
