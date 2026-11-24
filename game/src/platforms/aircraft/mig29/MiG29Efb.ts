/**
 * MiG-29 EFB pages (UI only): this aircraft's own systems drawn from its snapshot — twin RD-33
 * engines fed from tank 2, the GAF tank arrangement with turbo/jet pumps, the gearbox-driven AC/DC
 * generators with PTO and batteries, and the main/boost hydraulic systems with the emergency pump.
 * Layouts are schematic (after GAF T.O. 1F-MIG29-1 figs. 1-18/1-19 and the system descriptions).
 */
import { box, COLORS, engineCutaway, hbar, num, pipe, pump, svg, tank, text, valve } from "../../../app/efb/EfbKit.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { MIG29_HYDRAULICS } from "./MiG29Data.js";
import { F34_KG_PER_L } from "./MiG29FuelSystem.js";

type Snap = AircraftSnapshot;
const kg = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.kg ?? 0;
const cap = (s: Snap, id: string) => s.fuelTanks?.find((t) => t.id === id)?.capacityKg ?? 1;
const falling = (s: Snap, p: Snap | undefined, id: string) => !!p && kg(p, id) - kg(s, id) > 0.05;
const rising = (s: Snap, p: Snap | undefined, id: string) => !!p && kg(s, id) - kg(p, id) > 0.05;
const eng = (s: Snap, id: string) => s.engines.find((e) => e.id === id);
const gbxSpeed = (s: Snap) => { const l = eng(s, "left")?.spoolSpeed ?? 0, r = eng(s, "right")?.spoolSpeed ?? 0; return l >= r + MIG29_HYDRAULICS.gearboxEngineSelectMargin.value ? { v: l, by: "LH" } : { v: r, by: "RH" }; };

function enginesPage(s: Snap): string {
  const l = eng(s, "left"), r = eng(s, "right"), feed = s.engines.some((e) => e.fuelFlowKgS > 0);
  const g = gbxSpeed(s);
  return svg(760, 640, `
    ${tank(330, 14, 100, 54, kg(s, "tank2"), cap(s, "tank2"), "TANK 2 (FEED)")}${pump(348, 60, feed, 7)}${pump(412, 60, feed, 7)}
    ${pipe([[348, 68], [348, 110], [230, 110], [230, 150]], { flow: (l?.fuelFlowKgS ?? 0) > 0 })}
    ${pipe([[412, 68], [412, 110], [530, 110], [530, 150]], { flow: (r?.fuelFlowKgS ?? 0) > 0 })}
    ${l ? engineCutaway(230, 150, l, "left", `LH ${num(l.spoolSpeed * 100, 1)} % NH`) : ""}
    ${r ? engineCutaway(530, 150, r, "right", `RH ${num(r.spoolSpeed * 100, 1)} % NH`) : ""}
    ${box(320, 300, 120, 92, "GEARBOX (GBX)", [`driven by ${g.by}`, `${num(g.v * 100, 1)} %`, "AC+DC GEN · 2 HYD"], g.v > 0.5 ? "on" : "warn")}
    ${pipe([[285, 345], [320, 345]], { color: "#888" })}${pipe([[440, 345], [475, 345]], { color: "#888" })}
    ${text(380, 430, "RD-33 × 2", { anchor: "middle", size: 11, color: COLORS.dim })}
    ${text(380, 452, `${num(s.engines.reduce((a, e) => a + e.netThrustN, 0) / 1000, 1)} kN`, { anchor: "middle", size: 18, weight: 700 })}
    ${text(380, 472, `${num(s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600)} kg/h`, { anchor: "middle", size: 12 })}
    ${text(380, 492, `${(s.engines[0]?.control.mode ?? "").toUpperCase()} · ${s.engines.flatMap((e) => e.control.activeLimits).join(", ") || "no limiter"}`, { anchor: "middle", size: 10, color: COLORS.dim })}`);
}

function fuelPage(s: Snap, p: Snap | undefined): string {
  const t = (id: string, x: number, y: number, w: number, h: number, label: string, shape?: string) =>
    tank(x, y, w, h, kg(s, id), cap(s, id), label, { ...(shape ? { shape } : {}), active: falling(s, p, id) || rising(s, p, id) });
  const hasCl = s.fuelTanks?.some((x) => x.id === "centerline") ?? false;
  const total = s.fuelKg, ff = s.engines.reduce((a, e) => a + e.fuelFlowKgS, 0) * 3600;
  const f = (id: string) => falling(s, p, id);
  return svg(600, 690, `
    ${text(20, 34, `${total.toFixed(0)} kg`, { size: 22 })}
    ${text(20, 56, `${(total / F34_KG_PER_L).toFixed(0)} L F-34`, { size: 12, color: COLORS.dim })}
    ${text(20, 84, `${ff.toFixed(0)} kg/h`, { size: 16 })}
    ${text(20, 104, `endurance ${ff > 1 ? (total / ff * 60).toFixed(0) : "—"} min`, { size: 11, color: COLORS.dim })}
    ${text(20, 130, `CG ${(s.cgFractionMac * 100).toFixed(1)} % MAC`, { size: 13 })}
    ${kg(s, "tank2") < 550 ? text(20, 156, "550 KG REMAIN", { size: 13, color: COLORS.caution, weight: 700 }) : ""}
    ${pipe([[300, 110], [300, 130]], { flow: f("tank1") })}
    ${pipe([[350, 300], [350, 262], [390, 262], [390, 170], [360, 170]], { flow: f("tank3") })}
    ${pipe([[250, 300], [250, 262], [210, 262], [210, 75], [240, 75]], { flow: f("tank3") && rising(s, p, "tank1") })}
    ${pipe([[195, 285], [218, 285], [218, 360], [230, 360]], { flow: f("wingL") })}${pipe([[405, 285], [382, 285], [382, 360], [370, 360]], { flow: f("wingR") })}
    ${pipe([[180, 470], [180, 420], [230, 420]], { flow: f("tank3A1") })}${pipe([[420, 470], [420, 420], [370, 420]], { flow: f("tank3A2") })}
    ${pipe([[300, 210], [300, 246], [30, 246], [30, 660]], { flow: ff > 0 })}${pipe([[300, 246], [570, 246], [570, 660]], { flow: ff > 0 })}
    ${t("tank1", 240, 40, 120, 70, "TANK 1")}${pump(258, 100, f("tank1"))}
    ${t("tank2", 240, 130, 120, 80, "TANK 2 · FEED")}${valve(300, 120, true)}
    ${t("tank3", 230, 300, 140, 140, "TANK 3")}${pump(250, 428, f("tank3"))}${pump(350, 428, f("tank3") && rising(s, p, "tank1"))}
    ${t("wingL", 45, 262, 150, 70, "WING L", "M45,300 L195,262 L195,312 L65,332 Z")}${t("wingR", 405, 262, 150, 70, "WING R", "M555,300 L405,262 L405,312 L535,332 Z")}
    ${t("tank3A1", 150, 470, 60, 130, "3A1")}${t("tank3A2", 390, 470, 60, 130, "3A2")}
    ${text(30, 678, "LH ENG", { anchor: "middle", size: 10 })}${text(570, 678, "RH ENG", { anchor: "middle", size: 10 })}
    ${hasCl ? `${pipe([[345, 640], [520, 640], [520, 20], [300, 20], [300, 40]], { flow: f("centerline") })}${t("centerline", 255, 615, 90, 55, "CL TANK")}${valve(520, 330, f("centerline") || kg(s, "centerline") > 30)}` : text(300, 650, "no CL tank fitted", { anchor: "middle", size: 10, color: COLORS.dim })}`);
}

function electricsPage(s: Snap): string {
  const el = s.electrical;
  if (!el) return svg(600, 200, text(20, 40, "No electrical model"));
  const src = (id: string) => el.sources.find((x) => x.id === id)!;
  const bus = (id: string) => el.buses.find((x) => x.id === id)!;
  const g = gbxSpeed(s);
  const gen = (x: number, id: string, name: string, v: number) => { const o = src(id); return box(x, 70, 170, 74, name, [`${o.tripped ? "TRIPPED" : o.online ? "ONLINE" : "OFF"}`, `${(o.loadW / 1000).toFixed(1)} kW · ${(o.loadW / v).toFixed(0)} A`, `GBX ${num(g.v * 100, 0)} %`], o.tripped ? "warn" : o.online ? "on" : "off"); };
  const busBox = (x: number, y: number, id: string, name: string, v: number) => { const b = bus(id); return box(x, y, 200, 62, name, [b.powered ? `from ${b.sourceId}` : "UNPOWERED", `${v} V · ${(b.loadW / v).toFixed(1)} A${b.shed ? " · SHED" : ""}`], !b.powered ? "warn" : b.shed ? "shed" : "on", id === "ac" ? "#ff9b9b" : "#9bb0ff"); };
  const bat = src("battery"), pto = src("pto");
  const acOnPto = bus("ac").sourceId === "pto", dcOnBat = bus("dc").sourceId === "battery";
  return svg(600, 560, `
    ${box(215, 10, 170, 40, "GBX", [`${g.by} engine · ${num(g.v * 100, 1)} %`], g.v > 0.55 ? "on" : "warn")}
    ${gen(30, "gen.ac", "AC GEN 30 kVA", 115)}${gen(400, "gen.dc", "DC GEN 12 kW", 28.5)}
    ${pipe([[115, 144], [115, 300]], { flow: src("gen.ac").online, color: COLORS.elec, fluid: "#ffb3b3" })}
    ${pipe([[485, 144], [485, 300]], { flow: src("gen.dc").online, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${busBox(15, 300, "ac", "AC BUS 115 V 400 Hz", 115)}${busBox(385, 300, "dc", "DC BUS 28 V", 28)}
    ${box(230, 200, 140, 62, "PTO DC/AC", [pto.online ? `ON · ${(pto.loadW / 1000).toFixed(1)} kVA` : "standby", "1.5 kVA"], pto.online ? "shed" : "off")}
    ${pipe([[385, 330], [370, 330], [370, 231]], { flow: acOnPto, color: COLORS.dc, fluid: "#b3c4ff" })}${pipe([[230, 231], [215, 231], [215, 330]], { flow: acOnPto, color: COLORS.elec, fluid: "#ffb3b3" })}
    ${box(400, 420, 170, 74, "BATTERIES Ag-Zn", [`${num(bat.chargeAh, 1)} Ah`, bat.online ? `DISCHARGING ${(bat.loadW / 27.6).toFixed(0)} A` : "standby (not charged)", "27.6 V nominal"], bat.online ? "shed" : "on", "#8fe28f")}
    ${pipe([[485, 420], [485, 362]], { flow: dcOnBat, color: COLORS.dc, fluid: "#b3c4ff" })}
    ${text(20, 400, "Shed on PTO (GAF list):", { size: 10, color: COLORS.dim })}
    ${["INS heaters · radar & sight", "IRST / LRF / HMS · probe & windshield heat", "AFCS (SAU) · armament · IFF encoder"].map((l, i) => text(20, 418 + 15 * i, l, { size: 10, color: acOnPto ? COLORS.caution : COLORS.dim })).join("")}
    ${text(20, 490, `SAU ${s.annunciations.includes("SAU OFF (NO POWER)") ? "UNPOWERED" : "powered"}`, { size: 12, color: s.annunciations.includes("SAU OFF (NO POWER)") ? COLORS.warn : COLORS.ok })}`);
}

function hydraulicsPage(s: Snap): string {
  const h = s.hydraulics;
  if (!h) return svg(600, 200, text(20, 40, "No hydraulic model"));
  const nom = MIG29_HYDRAULICS.nominalPressurePa.value, g = gbxSpeed(s);
  const circ = (x: number, id: string, name: string) => {
    const c = h.circuits.find((k) => k.id === id)!, f = c.pressurePa / nom;
    const color = f < 0.48 ? COLORS.warn : f < 0.9 ? COLORS.caution : COLORS.ok;
    return `${box(x, 60, 230, 120, name, [`${(c.pressurePa / 1e6).toFixed(1)} MPa · ${(c.pressurePa / 98066.5).toFixed(0)} kp/cm²`, `pump ${(c.pumpFlowM3s * 60000).toFixed(1)} L/min`, `demand ${(c.demandFlowM3s * 60000).toFixed(1)} L/min`, `accumulator ${(c.accumulatorFluidM3 * 1000).toFixed(2)} L`], f < 0.48 ? "warn" : "on", "#d9b3ff")}
      ${hbar(x + 10, 200, 210, "PRESSURE (0–24 MPa)", c.pressurePa / 24e6, `${(c.pressurePa / 1e6).toFixed(1)}`, color)}`;
  };
  const emerg = h.circuits.find((c) => c.id === "booster")!.pumpFlowM3s > 0 && g.v < 0.3;
  return svg(600, 520, `
    ${box(215, 6, 170, 40, "GBX PUMPS", [`${g.by} · ${num(g.v * 100, 0)} %`], g.v > 0.5 ? "on" : "warn")}
    ${pipe([[135, 250], [135, 300], [300, 300], [300, 330]], { flow: g.v > 0.5, color: COLORS.hyd, fluid: "#e9d5ff" })}${pipe([[465, 250], [465, 300], [300, 300]], { flow: g.v > 0.5, color: COLORS.hyd, fluid: "#e9d5ff" })}
    ${circ(20, "main", "MAIN SYSTEM")}${circ(350, "booster", "BOOST SYSTEM")}${pump(135, 245, g.v > 0.5)}${pump(465, 245, g.v > 0.5)}
    ${box(200, 330, 200, 104, "FLIGHT CONTROLS", ["tailerons · ailerons", "rudders · diff. tailerons", "dual chambers", "(full control on either)"], "on", "#d9b3ff")}
    ${box(20, 330, 160, 104, "MAIN ONLY", ["LEF · flaps", "gear · brakes · NWS", "speedbrakes", "intake ramps"], "on", "#d9b3ff")}
    ${box(420, 330, 160, 74, "EMERGENCY PUMP", [emerg ? "RUNNING" : "standby", "fuel driven · ≥85 % both", "→ boost system"], emerg ? "shed" : "off", "#d9b3ff")}
    ${text(20, 470, "Relief 24 MPa · low warning 10 MPa · accumulators 8 MPa N₂ (GAF T.O.)", { size: 10, color: COLORS.dim })}`);
}

export const MIG29_EFB = {
  title: "MiG-29 EFB",
  pages: [
    { id: "engines", title: "Engines", render: (s: Snap) => enginesPage(s) },
    { id: "fuel", title: "Fuel", render: (s: Snap, p: Snap | undefined) => fuelPage(s, p) },
    { id: "electrics", title: "Electrics", render: (s: Snap) => electricsPage(s) },
    { id: "hydraulics", title: "Hydraulics", render: (s: Snap) => hydraulicsPage(s) }
  ]
} as const;
