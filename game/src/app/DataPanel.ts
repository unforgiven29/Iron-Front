/**
 * In-game data panel (UI only; reads the immutable snapshot, never changes simulation state).
 * Toggle with I; pages with 1 / 2 / 3 or the tabs:
 *  1 SURFACES — top-view diagram with every control surface / slat coloured by deflection, plus flight state.
 *  2 ENGINES  — per engine: spool and thrust gauges, temperatures, flows, nozzle, afterburner, control limiters.
 *  3 SYSTEMS  — hydraulic circuits, electrical buses and sources, fuel tanks and CG.
 * Platform-neutral: surfaces, engines, tanks and buses come from the aircraft's own definition/snapshot.
 */
import type { AircraftDefinition } from "../platforms/aircraft/common/AircraftDefinition.js";
import { solveCycle } from "../physics/propulsion/MixedFlowTurbofan.js";
import type { AircraftSnapshot, EngineSnapshot } from "../platforms/aircraft/common/FixedWingAircraft.js";

const DEG = 180 / Math.PI, KT = 1.943844, FT = 3.28084, KGF = 9.80665;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Fixed-point text, or "—" where the engine/aero model does not compute the quantity. */
const num = (v: number, digits: number) => (Number.isFinite(v) ? v.toFixed(digits) : "—");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Blue (negative) → grey (0) → orange (positive) by fraction of travel. */
const deflColor = (f: number) => {
  const t = Math.max(-1, Math.min(1, f));
  return t >= 0 ? `hsl(28 ${Math.round(90 * t)}% ${Math.round(42 + 10 * t)}%)` : `hsl(205 ${Math.round(-90 * t)}% ${Math.round(42 - 10 * t)}%)`;
};

function bar(label: string, value: number, max: number, text: string, color = "#4fb3ff"): string {
  const f = clamp01(value / max);
  return `<div class="dp-bar"><span class="dp-bar-label">${esc(label)}</span><span class="dp-bar-track"><span class="dp-bar-fill" style="width:${(f * 100).toFixed(1)}%;background:${color}"></span></span><span class="dp-bar-val">${esc(text)}</span></div>`;
}

/** Centred bar for signed values (surface deflection). */
function signedBar(label: string, value: number, min: number, max: number, unit = "°"): string {
  const span = Math.max(Math.abs(min), Math.abs(max)) || 1;
  const f = Math.max(-1, Math.min(1, value / span));
  const left = f < 0 ? 50 + f * 50 : 50, width = Math.abs(f) * 50;
  return `<div class="dp-bar"><span class="dp-bar-label">${esc(label)}</span><span class="dp-bar-track dp-signed"><span class="dp-bar-fill" style="left:${left}%;width:${width}%;background:${deflColor(f)}"></span><span class="dp-zero"></span></span><span class="dp-bar-val">${value.toFixed(1)}${unit}</span></div>`;
}

/** Arc gauge (SVG), 0..1 over 240°. */
function arcGauge(fraction: number, label: string, valueText: string, color: string, redFrom = 1.01): string {
  const r = 34, cx = 44, cy = 44, a0 = (150 * Math.PI) / 180, sweep = (240 * Math.PI) / 180;
  const pt = (f: number) => [cx + r * Math.cos(a0 + sweep * f), cy + r * Math.sin(a0 + sweep * f)];
  const arc = (f0: number, f1: number) => { const [x0, y0] = pt(f0), [x1, y1] = pt(f1); return `M${x0!.toFixed(1)},${y0!.toFixed(1)} A${r},${r} 0 ${(f1 - f0) * 240 > 180 ? 1 : 0} 1 ${x1!.toFixed(1)},${y1!.toFixed(1)}`; };
  const f = clamp01(fraction);
  const red = redFrom < 1 ? `<path d="${arc(redFrom, 1)}" stroke="#e5484d" stroke-width="4" fill="none"/>` : "";
  return `<svg class="dp-gauge" viewBox="0 0 88 80"><path d="${arc(0, 1)}" stroke="#2a3a48" stroke-width="7" fill="none" stroke-linecap="round"/>${red}${f > 0.001 ? `<path d="${arc(0, f)}" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>` : ""}<text x="44" y="46" text-anchor="middle" class="dp-gauge-val">${esc(valueText)}</text><text x="44" y="74" text-anchor="middle" class="dp-gauge-lbl">${esc(label)}</text></svg>`;
}

/** Top-view aircraft with surfaces coloured by deflection fraction. */
function surfaceDiagram(s: AircraftSnapshot, def: AircraftDefinition): string {
  const frac = (id: string) => {
    const spec = def.surfaces.find((x) => x.id === id);
    if (!spec) return Number.NaN;
    const v = s.surfaces[id] ?? 0, lim = v >= 0 ? spec.limitDeg : Math.abs(spec.minDeg ?? -spec.limitDeg);
    return lim > 0 ? v / lim : 0;
  };
  const has = (id: string) => def.surfaces.some((x) => x.id === id);
  const fill = (f: number) => (Number.isNaN(f) ? "#1c2833" : deflColor(f));
  const ail = frac("aileron"), el = frac("elevator"), diff = has("differentialStabilator") ? frac("differentialStabilator") : 0;
  const lef = frac("lef"), rud = frac("rudder"), sb = frac("speedbrake");
  const lbl = (x: number, y: number, t: string, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="dp-diag-lbl">${esc(t)}</text>`;
  const val = (id: string) => (has(id) ? `${(s.surfaces[id] ?? 0).toFixed(1)}°` : "—");
  // Roll surfaces: + = roll right → left aileron down (shown +), right aileron up (shown −).
  return `<svg class="dp-diagram" viewBox="0 0 400 300">
    <path d="M200,18 L212,70 L214,190 L206,262 L194,262 L186,190 L188,70 Z" fill="#22313f" stroke="#4a6378"/>
    <path d="M190,100 L40,180 L42,196 L190,170 Z" fill="#1d2b37" stroke="#4a6378"/>
    <path d="M210,100 L360,180 L358,196 L210,170 Z" fill="#1d2b37" stroke="#4a6378"/>
    <path d="M188,100 L42,178 L48,184 L190,108 Z" fill="${fill(lef)}" stroke="#4a6378"/>
    <path d="M212,100 L358,178 L352,184 L210,108 Z" fill="${fill(lef)}" stroke="#4a6378"/>
    <path d="M110,178 L60,190 L62,196 L112,186 Z" fill="${fill(ail)}" stroke="#4a6378"/>
    <path d="M290,178 L340,190 L338,196 L288,186 Z" fill="${fill(-ail)}" stroke="#4a6378"/>
    <path d="M192,226 L128,262 L130,272 L193,256 Z" fill="${fill(el + diff)}" stroke="#4a6378"/>
    <path d="M208,226 L272,262 L270,272 L207,256 Z" fill="${fill(el - diff)}" stroke="#4a6378"/>
    <path d="M197,212 L203,212 L203,262 L197,262 Z" fill="${fill(rud)}" stroke="#4a6378"/>
    <rect x="193" y="264" width="14" height="10" fill="${fill(sb)}" stroke="#4a6378"/>
    ${lbl(110, 140, `SLATS/LEF ${val("lef")}`)}
    ${lbl(70, 214, `L AIL ${has("aileron") ? (s.surfaces["aileron"] ?? 0).toFixed(1) : "—"}°`)}
    ${lbl(330, 214, `R AIL ${has("aileron") ? (-(s.surfaces["aileron"] ?? 0)).toFixed(1) : "—"}°`)}
    ${lbl(128, 290, `L STAB ${((s.surfaces["elevator"] ?? 0) + (s.surfaces["differentialStabilator"] ?? 0)).toFixed(1)}°`)}
    ${lbl(272, 290, `R STAB ${((s.surfaces["elevator"] ?? 0) - (s.surfaces["differentialStabilator"] ?? 0)).toFixed(1)}°`)}
    ${lbl(232, 236, `RUD ${val("rudder")}`, "start")}
    ${lbl(232, 278, `SPDBRK ${val("speedbrake")}`, "start")}
  </svg>`;
}

function surfacesPage(s: AircraftSnapshot, def: AircraftDefinition): string {
  const rows = def.surfaces.map((sp) => signedBar(sp.id.toUpperCase(), s.surfaces[sp.id] ?? 0, sp.minDeg ?? -sp.limitDeg, sp.limitDeg)).join("");
  const gear = s.gear ? bar("GEAR", s.gear.extension, 1, s.gear.extension >= 1 ? "DOWN" : s.gear.extension <= 0 ? "UP" : `${(s.gear.extension * 100).toFixed(0)}%`, "#7bd88f") : "";
  const state: [string, string][] = [
    ["FCS MODE", s.fcsMode], ["AoA", `${(s.alphaRad * DEG).toFixed(1)}°`], ["SIDESLIP", `${(s.betaRad * DEG).toFixed(1)}°`],
    ["LOAD", `${s.nzG.toFixed(2)} g`], ["KEAS", (s.equivalentAirspeedMps * KT).toFixed(0)], ["MACH", s.mach.toFixed(3)],
    ["ALT", `${(s.altitudeMslM * FT).toFixed(0)} ft`], ["P / Q / R", s.ratesRadps.map((r) => (r * DEG).toFixed(1)).join(" / ") + " °/s"],
    ["CG", `${(s.cgFractionMac * 100).toFixed(1)} % MAC`], ["MASS", `${s.massKg.toFixed(0)} kg`]
  ];
  return `<div class="dp-grid2"><div>${surfaceDiagram(s, def)}<div class="dp-legend"><span style="background:${deflColor(-1)}"></span>− full<span style="background:${deflColor(0)}"></span>neutral<span style="background:${deflColor(1)}"></span>+ full</div></div>
    <div><h3>Surface positions</h3>${rows}${gear}<h3>Flight state</h3>${table(state)}${bar("BUFFET", s.buffet, 1, `${(s.buffet * 100).toFixed(0)}%`, s.buffet > 0.5 ? "#e5484d" : "#f5a524")}</div></div>`;
}

function table(rows: readonly (readonly [string, string])[]): string {
  return `<table class="dp-table">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
}

function engineCard(e: EngineSnapshot, maxThrustN: number): string {
  const thrustF = e.netThrustN / maxThrustN;
  const n2 = e.n2Rpm !== undefined ? `${e.n2Rpm.toFixed(0)} rpm` : "—";
  const throat = e.nozzle.position;
  const rows: [string, string][] = [
    ["Control mode", e.control.mode.toUpperCase()], ["Speed demand", `${(e.control.speedDemand * 100).toFixed(1)} %`],
    ["Scheduled speed", `${(e.control.scheduledSpeed * 100).toFixed(1)} %`], ["Corrected speed", `${(e.correctedSpeed * 100).toFixed(1)} %`],
    ["Limiters", e.control.activeLimits.length ? e.control.activeLimits.join(", ") : "none"],
    ["Net thrust", `${(e.netThrustN / 1000).toFixed(1)} kN (${(e.netThrustN / KGF).toFixed(0)} kgf)`],
    ["Gross / ram drag", `${(e.grossThrustN / 1000).toFixed(1)} / ${(e.ramDragN / 1000).toFixed(1)} kN`],
    ["Nozzle momentum / pressure", `${(e.nozzle.momentumThrustN / 1000).toFixed(1)} / ${(e.nozzle.pressureThrustN / 1000).toFixed(1)} kN`],
    ["Airflow", `${e.airflowKgS.toFixed(1)} kg/s`], ["Fuel flow", `${(e.fuelFlowKgS * 3600).toFixed(0)} kg/h`],
    ["Compressor exit P / T", `${(e.compressorExitPressurePa / 1e5).toFixed(2)} bar / ${(e.compressorExitTemperatureK - 273.15).toFixed(0)} °C`],
    ["Turbine inlet T", Number.isFinite(e.turbineInletTemperatureK) ? `${(e.turbineInletTemperatureK - 273.15).toFixed(0)} °C` : "— (not in engine data)"],
    ["EGT", e.exhaustGasTemperatureK !== undefined ? `${(e.exhaustGasTemperatureK - 273.15).toFixed(0)} °C` : "—"],
    ["Nozzle T", `${(e.nozzleTemperatureK - 273.15).toFixed(0)} °C`],
    ["Throat / exit area", `${num(e.nozzle.throatAreaM2, 3)} / ${num(e.nozzle.exitAreaM2, 3)} m²`],
    ["N1 / N2", `${e.n1Rpm !== undefined ? e.n1Rpm.toFixed(0) + " rpm" : "—"} / ${n2}`],
    ["Status", e.flameout ? "FLAMEOUT" : e.backPressureLimited ? "BACK-PRESSURE LIMITED" : e.outsideDeck ? "OUTSIDE DECK" : "RUNNING"]
  ];
  return `<div class="dp-card"><h3>ENGINE ${esc(e.id.toUpperCase())}${e.afterburnerLit ? ' <span class="dp-ab">AB</span>' : ""}</h3>
    <div class="dp-gauges">${arcGauge(e.spoolSpeed / 1.05, "SPOOL", `${(e.spoolSpeed * 100).toFixed(1)}%`, "#4fb3ff", 0.98)}${arcGauge(thrustF, "THRUST", `${(thrustF * 100).toFixed(0)}%`, "#7bd88f")}${arcGauge(e.afterburnerFraction, "AFTERBURNER", `${(e.afterburnerFraction * 100).toFixed(0)}%`, "#f5a524")}${arcGauge(Number.isFinite(throat) ? throat : 0, "NOZZLE", Number.isFinite(throat) ? `${(throat * 100).toFixed(0)}%` : "fixed", "#c084fc")}</div>
    ${table(rows)}</div>`;
}

function enginesPage(s: AircraftSnapshot, maxThrustN: number): string {
  const total = s.engines.reduce((a, e) => a + e.netThrustN, 0);
  const head = table([["Throttle", `${(s.throttle * 100).toFixed(0)} %`], ["Total thrust", `${(total / 1000).toFixed(1)} kN`], ["Thrust / weight", (total / (s.massKg * KGF)).toFixed(2)], ["Fuel remaining", `${s.fuelKg.toFixed(0)} kg`]]);
  return `<div>${head}<div class="dp-cards">${s.engines.map((e) => engineCard(e, maxThrustN)).join("")}</div></div>`;
}

function systemsPage(s: AircraftSnapshot, def: AircraftDefinition): string {
  const hyd = s.hydraulics;
  const hydHtml = hyd ? hyd.circuits.map((c) => {
    const nom = def.hydraulics?.circuits.find((x) => x.id === c.id)?.nominalPressurePa ?? 21e6;
    const f = c.pressurePa / nom;
    return bar(c.id.toUpperCase(), c.pressurePa, nom * 1.2, `${(c.pressurePa / 1e6).toFixed(1)} MPa`, f < 0.5 ? "#e5484d" : f < 0.85 ? "#f5a524" : "#7bd88f");
  }).join("") + (hyd.emergencyUnit ? table([["Emergency unit", `${hyd.emergencyUnit.state.toUpperCase()} (${hyd.emergencyUnit.remainingS.toFixed(0)} s)`]]) : "") : "<p>No hydraulic model</p>";
  const el = s.electrical;
  const elHtml = el ? `<table class="dp-table"><tr><th>Bus</th><th>Source</th><th>Load</th></tr>${el.buses.map((b) => `<tr class="${b.powered ? "" : "dp-off"}"><td>${esc(b.id)}</td><td>${b.powered ? esc(b.sourceId ?? "") + (b.shed ? " (SHED)" : "") : "UNPOWERED"}</td><td>${(b.loadW / 1000).toFixed(1)} kW</td></tr>`).join("")}</table>
    <table class="dp-table"><tr><th>Source</th><th>State</th><th>Load</th></tr>${el.sources.map((x) => `<tr class="${x.online ? "" : "dp-dim"}"><td>${esc(x.id)}</td><td>${x.tripped ? "TRIPPED" : x.online ? "ONLINE" : "standby/off"}${x.chargeAh !== undefined ? ` · ${x.chargeAh.toFixed(1)} Ah` : ""}</td><td>${(x.loadW / 1000).toFixed(1)} kW</td></tr>`).join("")}</table>` : "<p>No electrical model</p>";
  const fuel = s.fuelTanks ? s.fuelTanks.map((t) => bar(t.id, t.kg, t.capacityKg, `${t.kg.toFixed(0)} / ${t.capacityKg.toFixed(0)} kg`, "#f5d90a")).join("") : bar("FUEL", s.fuelKg, def.mass.internalFuelKg, `${s.fuelKg.toFixed(0)} kg`, "#f5d90a");
  const cg = `<div class="dp-cg"><span>CG</span><span class="dp-bar-track"><span class="dp-cg-mark" style="left:${(clamp01((s.cgFractionMac - 0.15) / 0.3) * 100).toFixed(1)}%"></span></span><span>${(s.cgFractionMac * 100).toFixed(1)} % MAC</span></div>`;
  return `<div class="dp-grid3"><div><h3>Hydraulics</h3>${hydHtml}</div><div><h3>Electrical</h3>${elHtml}</div><div><h3>Fuel</h3>${fuel}${cg}<p class="dp-note">CG scale 15–45 % MAC</p></div></div>`;
}

export function mountDataPanel(frame: HTMLElement, definition: AircraftDefinition, snapshot: () => AircraftSnapshot): { onKey(key: string): boolean; update(): void } {
  const root = document.createElement("div");
  root.className = "data-panel efb";
  root.hidden = true;
  const tabs = document.createElement("div");
  tabs.className = "dp-tabs";
  const body = document.createElement("div");
  body.className = "dp-body";
  // The aircraft's own EFB pages, then the shared flight-controls page. Aircraft without an EFB get
  // the generic engine/systems pages.
  const maxThrustN = Math.max(1, ...definition.engines.map((e) => solveCycle({ ...e.design, installationLossFraction: 0 }, { temperatureK: 288.15, pressurePa: 101325, mach: 0 }, 1, 1).netThrustN));
  const pages: { id: string; title: string; render: (s: AircraftSnapshot, p: AircraftSnapshot | undefined) => string }[] = [
    ...(definition.efb?.pages ?? [
      { id: "engines", title: "Engines", render: (s: AircraftSnapshot) => enginesPage(s, maxThrustN) },
      { id: "systems", title: "Systems", render: (s: AircraftSnapshot) => systemsPage(s, definition) }
    ]),
    { id: "controls", title: "Flight Controls", render: (s: AircraftSnapshot) => surfacesPage(s, definition) }
  ];
  let page = 0;
  const renderTabs = () => {
    tabs.replaceChildren(...pages.map((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = p.title;
      b.title = `${i + 1}`;
      b.className = i === page ? "active" : "";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); page = i; renderTabs(); update(true); frame.focus(); });
      return b;
    }), Object.assign(document.createElement("span"), { className: "dp-hint", textContent: `${definition.efb?.title ?? definition.displayName} · I close · 1–${pages.length} pages` }));
  };
  let lastUpdate = 0, previous: AircraftSnapshot | undefined, previousAt = 0, current: AircraftSnapshot | undefined;
  const update = (force = false) => {
    if (root.hidden) return;
    const now = performance.now();
    if (!force && now - lastUpdate < 100) return; // ≈10 Hz is plenty for a data page
    lastUpdate = now;
    const s = snapshot();
    // Keep a ≈1 s old snapshot so pages can show which transfers are active.
    if (!current || now - previousAt > 1000) { previous = current; previousAt = now; current = s; }
    body.innerHTML = pages[page]!.render(s, previous);
  };
  renderTabs();
  root.append(tabs, body);
  frame.append(root);
  return {
    onKey: (key) => {
      if (key === "i") { root.hidden = !root.hidden; update(true); return true; }
      if (root.hidden) return false;
      const n = Number(key);
      if (Number.isInteger(n) && n >= 1 && n <= pages.length) { page = n - 1; renderTabs(); update(true); return true; }
      return false;
    },
    update: () => update()
  };
}
