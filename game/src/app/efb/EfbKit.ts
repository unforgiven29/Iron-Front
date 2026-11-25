/**
 * Shared drawing kit for aircraft EFB pages (UI only). Produces SVG markup from values the caller
 * reads from the snapshot; it never computes physics. Each aircraft package composes its own
 * pages (its own tank layout, buses, engines) from these primitives.
 */
import type { EngineSnapshot } from "../../platforms/aircraft/common/FixedWingAircraft.js";

export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export const num = (v: number | undefined, digits = 0): string => (v !== undefined && Number.isFinite(v) ? v.toFixed(digits) : "—");
export const degC = (k: number | undefined): string => (k !== undefined && Number.isFinite(k) ? `${(k - 273.15).toFixed(0)}°C` : "—");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const COLORS = { bg: "#2b2d30", panel: "#1c1d1f", line: "#d9d9d9", text: "#f2f2f2", dim: "#8a8d91", fuel: "#1f7cf2", fuelEmpty: "#0d2a4d", ok: "#3fb950", caution: "#f5a524", warn: "#e5484d", hyd: "#c084fc", elec: "#e36d6d", dc: "#6c8cff" };

export function text(x: number, y: number, t: string, opts: { size?: number; anchor?: "start" | "middle" | "end"; color?: string; weight?: number; cls?: string } = {}): string {
  return `<text x="${x}" y="${y}" font-size="${opts.size ?? 12}" text-anchor="${opts.anchor ?? "start"}" fill="${opts.color ?? COLORS.text}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}${opts.cls ? ` class="${opts.cls}"` : ""}>${esc(t)}</text>`;
}

/** Double-line pipe through points; `flow` animates fluid moving along it. */
export function pipe(points: readonly (readonly [number, number])[], opts: { flow?: boolean; color?: string; fluid?: string } = {}): string {
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const fluid = opts.fluid ?? COLORS.fuel;
  return `<path d="${d}" stroke="${opts.color ?? COLORS.line}" stroke-width="7" fill="none" stroke-linejoin="round"/><path d="${d}" stroke="${COLORS.panel}" stroke-width="4" fill="none" stroke-linejoin="round"/>${opts.flow ? `<path d="${d}" stroke="${fluid}" stroke-width="3" fill="none" stroke-dasharray="5 5" class="efb-flow"/>` : ""}`;
}

/** Tank: outline, fill level, quantity text. `shape` points override the rectangle. */
export function tank(x: number, y: number, w: number, h: number, kg: number, capacityKg: number, label: string, opts: { unit?: (kg: number) => string; shape?: string; active?: boolean } = {}): string {
  const f = clamp01(capacityKg > 0 ? kg / capacityKg : 0);
  const id = `clip-${label.replace(/\W/g, "")}-${x}-${y}`;
  // With a custom shape, (x, y, w, h) is its bounding box (used for the fill level and the labels).
  const outline = opts.shape ?? `M${x},${y} h${w} v${h} h${-w} Z`;
  const fillY = y + h * (1 - f);
  return `<clipPath id="${id}"><path d="${outline}"/></clipPath>
    <path d="${outline}" fill="${COLORS.fuelEmpty}"/>
    <rect x="${x - 200}" y="${fillY}" width="${w + 400}" height="${h * f + 200}" fill="${COLORS.fuel}" clip-path="url(#${id})"/>
    <path d="${outline}" fill="none" stroke="${opts.active ? "#9fd0ff" : COLORS.line}" stroke-width="${opts.active ? 2 : 1.2}" rx="4"/>
    ${text(x + w / 2, y + h / 2 + 5, opts.unit ? opts.unit(kg) : `${kg.toFixed(0)}`, { anchor: "middle", size: 14 })}
    ${label ? text(x + w / 2, y + 14, label, { anchor: "middle", size: 9, color: "#cfe3ff" }) : ""}`;
}

/** Centrifugal/turbo pump: blades in a circle; green when running. */
export function pump(cx: number, cy: number, running: boolean, r = 9): string {
  const blades = Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3; return `<path d="M${cx},${cy} Q${cx + r * 0.9 * Math.cos(a + 0.6)},${cy + r * 0.9 * Math.sin(a + 0.6)} ${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}" stroke="${running ? COLORS.ok : COLORS.dim}" stroke-width="1.4" fill="none"/>`; }).join("");
  return `<g class="${running ? "efb-spin" : ""}" style="transform-origin:${cx}px ${cy}px"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLORS.panel}" stroke="${running ? COLORS.ok : COLORS.line}" stroke-width="1.5"/>${blades}</g>`;
}

/** Valve: white disc with a bar across (open) or along (closed, red) the line. */
export function valve(cx: number, cy: number, open: boolean, vertical = true): string {
  const bar = open === vertical ? `M${cx - 6},${cy} h12` : `M${cx},${cy - 6} v12`;
  return `<circle cx="${cx}" cy="${cy}" r="7" fill="#f2f2f2" stroke="${open ? COLORS.line : COLORS.warn}" stroke-width="1.5"/><path d="${bar}" stroke="${open ? "#333" : COLORS.warn}" stroke-width="3"/>`;
}

/** Check valve (flow direction `dir`): triangle against a bar; filled green while fluid passes. */
export function checkValve(cx: number, cy: number, dir: "right" | "left" | "up" | "down", passing: boolean): string {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return `<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${cx - 8}" y="${cy - 7}" width="16" height="14" fill="${COLORS.panel}" stroke="${COLORS.line}" stroke-width="1"/><path d="M${cx - 5},${cy - 5} L${cx + 3},${cy} L${cx - 5},${cy + 5} Z" fill="${passing ? COLORS.ok : "#555"}"/><path d="M${cx + 4},${cy - 5} v10" stroke="${COLORS.line}" stroke-width="2"/></g>`;
}

/** Gas-charged accumulator: capsule, fluid level (fraction) in `color`. */
export function accumulator(x: number, y: number, w: number, h: number, fraction: number, color = "#ff4d7a"): string {
  const f = clamp01(fraction), id = `acc-${x}-${y}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}"/></clipPath>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="#2a2c2f"/>
    <rect x="${x}" y="${y + h * (1 - f)}" width="${w}" height="${h * f}" fill="${color}" clip-path="url(#${id})"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="none" stroke="${COLORS.line}" stroke-width="1.2"/>`;
}

/** Generic labelled box (generator, bus, converter) with value lines. */
export function box(x: number, y: number, w: number, h: number, title: string, lines: readonly string[], state: "on" | "off" | "warn" | "shed" = "on", accent = "#7fd4ff"): string {
  const stroke = state === "off" ? COLORS.dim : state === "warn" ? COLORS.warn : state === "shed" ? COLORS.caution : COLORS.line;
  const fill = state === "off" ? "#141516" : "#18324a";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    ${text(x + 6, y + 14, title, { size: 11, color: state === "off" ? COLORS.dim : accent, weight: 600 })}
    ${lines.map((l, i) => text(x + w - 6, y + 14 + 14 * (i + 1) - (lines.length > 1 ? 0 : 0), l, { anchor: "end", size: 11, color: state === "off" ? COLORS.dim : COLORS.text })).join("")}`;
}

/** Horizontal bar gauge with a label and value. */
export function hbar(x: number, y: number, w: number, label: string, f: number, value: string, color: string): string {
  return `${text(x, y - 3, label, { size: 10, color: COLORS.dim })}${text(x + w, y - 3, value, { size: 10, anchor: "end" })}<rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="#3a3d41"/><rect x="${x}" y="${y}" width="${(w * clamp01(f)).toFixed(1)}" height="6" rx="3" fill="${color}"/>`;
}

/** Temperature (K) to a cool→hot colour for the engine cutaway. */
function heat(k: number): string {
  if (!Number.isFinite(k)) return "#555";
  const t = clamp01((k - 300) / 1700);
  const hue = 220 - 220 * Math.min(1, t * 1.3), light = 35 + 30 * t;
  return `hsl(${hue.toFixed(0)} 85% ${light.toFixed(0)}%)`;
}

/**
 * Vertical engine cutaway (intake at top): sections coloured by their station temperatures, exhaust
 * flame in the afterburner duct and an exhaust plume behind the nozzle (never over the engine),
 * nozzle opening by throat position. Station labels on
 * the given side.
 */
export function engineCutaway(cx: number, top: number, e: EngineSnapshot, side: "left" | "right", rpmLabel: string): string {
  const s = e.stations, w = 52;
  const lx = side === "left" ? cx - w - 14 : cx + w + 14, anchor = side === "left" ? "end" : "start";
  const L = (y: number, a: string, b?: string) => text(lx, y, a, { anchor, size: 13, weight: 600 }) + (b ? text(lx, y + 15, b, { anchor, size: 11, color: COLORS.dim }) : "");
  const throat = Number.isFinite(e.nozzle.position) ? e.nozzle.position : 0.4;
  const exitW = w * (0.55 + 0.4 * throat);
  const sec = (y: number, h: number, wTop: number, wBot: number, color: string, label: string) =>
    `<path d="M${cx - wTop / 2},${y} L${cx + wTop / 2},${y} L${cx + wBot / 2},${y + h} L${cx - wBot / 2},${y + h} Z" fill="${color}" stroke="#bbb" stroke-width="0.8" opacity="0.92"/>${text(cx, y + h / 2 + 4, label, { anchor: "middle", size: 8, color: "#111" })}`;
  const fan = Array.from({ length: 7 }, (_, i) => `<line x1="${cx - w / 2 + 4}" y1="${top + 34 + i * 4}" x2="${cx + w / 2 - 4}" y2="${top + 36 + i * 4}" stroke="#9cc6ff" stroke-width="1"/>`).join("");
  return `
    <path d="M${cx - w / 2 - 8},${top} L${cx - w / 2},${top + 30} L${cx + w / 2},${top + 30} L${cx + w / 2 + 8},${top} Z" fill="#3a4048" stroke="#ccc"/>
    ${fan}
    ${sec(top + 64, 70, w, w * 0.8, heat(s?.Tt3K ?? Number.NaN), "COMP")}
    ${sec(top + 134, 40, w * 0.8, w * 0.8, heat(s?.Tt4K ?? s?.Tt5K ?? Number.NaN), "BURNER")}
    ${sec(top + 174, 34, w * 0.8, w * 0.9, heat(s?.Tt5K ?? Number.NaN), "TURB")}
    ${sec(top + 208, 26, w * 0.9, w, heat(s?.Tt6K ?? Number.NaN), "MIX")}
    <path d="M${cx - w / 2},${top + 234} L${cx + w / 2},${top + 234} L${cx + exitW / 2},${top + 330} L${cx - exitW / 2},${top + 330} Z" fill="#2a2c30" stroke="#ccc"/>
    ${afterburnerFlame(cx, top, w, exitW, e, side)}
    <path d="M${cx - exitW / 2},${top + 330} l-6,24 M${cx + exitW / 2},${top + 330} l6,24" stroke="#ccc" stroke-width="2"/>
    ${L(top + 14, rpmLabel, `NH ${num(e.spoolSpeed * 100, 1)} % · NL ${num(e.fanSpeed * 100, 1)} %`)}
    ${L(top + 52, `${num(e.airflowKgS, 1)} kg/s`, `core ${num(s?.coreFlowKgS, 1)} · bypass ${num(s?.bypassFlowKgS, 1)} (BPR ${num(s?.bypassRatio, 2)})`)}
    ${text(lx, top + 82, `T2 ${degC(s?.Tt2K)} · P2 ${num((s?.pt2Pa ?? Number.NaN) / 1000, 0)} kPa`, { anchor, size: 11, color: COLORS.dim })}
    ${L(top + 104, `T3 ${degC(s?.Tt3K)}`, `P3 ${num((s?.pt3Pa ?? Number.NaN) / 1e5, 1)} bar · P3/P2 ${num((s?.pt3Pa ?? Number.NaN) / (s?.pt2Pa ?? Number.NaN), 1)}`)}
    ${L(top + 150, `TIT ${degC(s?.Tt4K)}`, `main ${num((s?.mainFuelKgS ?? Number.NaN) * 3600)} kg/h · f/a ${num((s?.fuelAirRatio ?? Number.NaN) * 1000, 1)} g/kg`)}
    ${L(top + 192, `T5 ${degC(s?.Tt5K)}`, e.exhaustGasTemperatureK !== undefined ? `EGT ${degC(e.exhaustGasTemperatureK)}` : `mixer ${degC(s?.Tt6K)}`)}
    ${L(top + 236, `T7 ${degC(s?.Tt7K)}`, `AB ${e.afterburnerLit ? num(e.afterburnerFraction * 100) + " %" : "off"} · ${num((s?.afterburnerFuelKgS ?? 0) * 3600)} kg/h`)}
    ${Number.isFinite(e.nozzleActualPosition) ? L(top + 280, `A8 ${num(e.nozzle.throatAreaM2, 3)} m²`, `A9 ${num(e.nozzle.exitAreaM2, 3)} m² · cmd ${num(e.nozzleCommandPosition * 100)} % act ${num(e.nozzleActualPosition * 100)} %`) : L(top + 280, "nozzle fixed", "")}
    ${L(top + 340, `${num(e.netThrustN / 1000, 1)} kN`, `total ${num(e.fuelFlowKgS * 3600)} kg/h · f/a ${num((s?.totalFuelAirRatio ?? Number.NaN) * 1000, 1)} g/kg`)}
    ${e.flameout ? text(cx, top + 290, "FLAMEOUT", { anchor: "middle", size: 12, color: COLORS.warn, weight: 700 }) : ""}`;
}

/**
 * Afterburner duct glow (inside the duct, behind the flameholders) and the exhaust plume, which
 * starts at the nozzle flap tips and grows with the afterburner fraction. Shock diamonds show while
 * the afterburner is lit. Plume length is capped at 80 px so it never overlaps page text below.
 */
function afterburnerFlame(cx: number, top: number, w: number, exitW: number, e: EngineSnapshot, side: string): string {
  if (e.flameout) return "";
  const lit = e.afterburnerLit, f = clamp01(e.afterburnerFraction);
  const id = `ab-${side}`;
  const ductTop = top + 246, ductBot = top + 330, flapTip = top + 354, mouth = exitW + 12;
  // Duct: flameholder gutters always drawn; glow only when lit.
  const gutters = [0.55, 0.8].map((k) => `<path d="M${cx - (w / 2) * k},${top + 240} l${(w / 2) * k * 0.25},6 M${cx + (w / 2) * k},${top + 240} l${-(w / 2) * k * 0.25},6" stroke="#888" stroke-width="1.5" fill="none"/>`).join("");
  const duct = lit ? `<path d="M${cx - w / 2 + 3},${ductTop} L${cx + w / 2 - 3},${ductTop} L${cx + exitW / 2 - 3},${ductBot} L${cx - exitW / 2 + 3},${ductBot} Z" fill="url(#${id}-duct)" opacity="${0.35 + 0.5 * f}"/>` : "";
  // Plume: dry = short faint heat haze; lit = orange outer flame and a white-yellow core.
  const len = lit ? 34 + 46 * f : 16;
  const outer = `<path d="M${cx - mouth / 2},${flapTip} C${cx - mouth / 2},${flapTip + len * 0.5} ${cx - mouth * 0.18},${flapTip + len * 0.85} ${cx},${flapTip + len} C${cx + mouth * 0.18},${flapTip + len * 0.85} ${cx + mouth / 2},${flapTip + len * 0.5} ${cx + mouth / 2},${flapTip} Z" fill="url(#${id}-outer)"/>`;
  const coreW = mouth * 0.55, coreLen = len * 0.6;
  const core = lit ? `<path d="M${cx - coreW / 2},${flapTip} Q${cx - coreW * 0.35},${flapTip + coreLen * 0.7} ${cx},${flapTip + coreLen} Q${cx + coreW * 0.35},${flapTip + coreLen * 0.7} ${cx + coreW / 2},${flapTip} Z" fill="url(#${id}-core)"/>` : "";
  const diamonds = lit ? Array.from({ length: 3 }, (_, i) => {
    const y = flapTip + len * (0.2 + 0.24 * i), dw = mouth * (0.22 - 0.05 * i), dh = 6 + 4 * f;
    return `<path d="M${cx},${y - dh} L${cx + dw / 2},${y} L${cx},${y + dh} L${cx - dw / 2},${y} Z" fill="#fffbe6" opacity="${(0.75 - 0.2 * i) * (0.5 + 0.5 * f)}"/>`;
  }).join("") : "";
  return `<defs>
      <linearGradient id="${id}-duct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347" stop-opacity="0.2"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient>
      <linearGradient id="${id}-outer" x1="0" y1="0" x2="0" y2="1">${lit
        ? `<stop offset="0" stop-color="#ff8c2a" stop-opacity="0.95"/><stop offset="0.6" stop-color="#ff5a1f" stop-opacity="0.6"/><stop offset="1" stop-color="#c2361b" stop-opacity="0"/>`
        : `<stop offset="0" stop-color="#9a7a5a" stop-opacity="0.45"/><stop offset="1" stop-color="#9a7a5a" stop-opacity="0"/>`}</linearGradient>
      <linearGradient id="${id}-core" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#fff2b0" stop-opacity="0.85"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></linearGradient>
    </defs>${duct}${gutters}${outer}${core}${diamonds}`;
}

/** Wrap a page body in an SVG canvas. */
export function svg(width: number, height: number, body: string): string {
  return `<svg class="efb-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace, Menlo, Consolas, monospace">${body}</svg>`;
}

/** Engine health / stability panel (two spools, surge margin, oil, vibration, AB zones, life). */
export function engineHealthPanel(x: number, y: number, w: number, e: EngineSnapshot, title: string, limits: { oilTempWarnC?: number; oilPressMinPa?: number } = {}): string {
  const h = e.health;
  const sm = e.surgeMargin, smF = Number.isFinite(sm) ? Math.max(0, Math.min(1, sm / 0.25)) : 0;
  const smColor = e.surging ? COLORS.warn : sm < 0.05 ? COLORS.caution : COLORS.ok;
  const zones = e.afterburnerZones;
  const zoneBoxes = Array.from({ length: zones }, (_, i) => `<rect x="${x + 10 + i * 34}" y="${y + 330}" width="28" height="14" rx="2" fill="${e.afterburnerBlowout ? COLORS.warn : i < e.afterburnerZonesLit ? "#ff9a3c" : "#3a3d41"}" stroke="#777"/>`).join("");
  const oilC = h ? h.oilTemperatureK - 273.15 : Number.NaN;
  const oilWarn = limits.oilTempWarnC !== undefined && oilC > limits.oilTempWarnC;
  const pressLow = h !== undefined && limits.oilPressMinPa !== undefined && e.spoolSpeed > 0.5 && h.oilPressurePa < limits.oilPressMinPa;
  return `<rect x="${x}" y="${y}" width="${w}" height="420" rx="6" fill="${COLORS.panel}" stroke="#44474c"/>
    ${text(x + 10, y + 22, title, { size: 13, weight: 700, color: "#7fd4ff" })}
    ${e.surging ? text(x + w - 10, y + 22, "SURGE", { size: 13, anchor: "end", weight: 700, color: COLORS.warn }) : ""}
    ${hbar(x + 10, y + 52, w - 20, "NH core", e.spoolSpeed / 1.05, `${num(e.spoolSpeed * 100, 1)} %`, "#4fb3ff")}
    ${hbar(x + 10, y + 86, w - 20, "NL fan", e.fanSpeed / 1.05, `${num(e.fanSpeed * 100, 1)} %`, "#7fd4ff")}
    ${hbar(x + 10, y + 120, w - 20, "SURGE MARGIN", smF, Number.isFinite(sm) ? `${num(sm * 100, 1)} %` : "—", smColor)}
    ${h ? `${hbar(x + 10, y + 154, w - 20, "OIL TEMP", (h.oilTemperatureK - 273.15) / 220, `${num(oilC)}°C`, oilWarn ? COLORS.warn : COLORS.ok)}
    ${hbar(x + 10, y + 188, w - 20, "OIL PRESS", h.oilPressurePa / 4.5e5, `${num(h.oilPressurePa / 98066.5, 2)} kp/cm²`, pressLow ? COLORS.warn : COLORS.ok)}
    ${hbar(x + 10, y + 222, w - 20, "VIBRATION", h.vibration, `${num(h.vibration * 100)} %`, h.vibration > 1 ? COLORS.warn : h.vibration > 0.7 ? COLORS.caution : COLORS.ok)}
    ${text(x + 10, y + 260, `hot-section ${num(h.hotSectionEquivalentS / 60, 1)} eq-min`, { size: 11 })}
    ${text(x + 10, y + 278, `afterburner ${num(h.afterburnerTimeS, 0)} s · surges ${h.surgeCount}`, { size: 11 })}` : text(x + 10, y + 160, "no health model", { size: 11, color: COLORS.dim })}
    ${text(x + 10, y + 318, `AFTERBURNER ${zones ? `${e.afterburnerZonesLit}/${zones} zones` : ""}${e.afterburnerBlowout ? " · BLOW-OUT" : ""}`, { size: 11, color: e.afterburnerBlowout ? COLORS.warn : COLORS.text })}
    ${zoneBoxes}
    ${text(x + 10, y + 372, `limiters: ${e.control.activeLimits.join(", ") || "none"}`, { size: 10, color: COLORS.dim })}
    ${text(x + 10, y + 390, `${e.control.mode.toUpperCase()} · demand ${num(e.control.speedDemand * 100, 1)} %`, { size: 10, color: COLORS.dim })}`;
}
