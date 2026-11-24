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
 * plume by nozzle temperature and afterburner, nozzle opening by throat position. Station labels on
 * the given side.
 */
export function engineCutaway(cx: number, top: number, e: EngineSnapshot, side: "left" | "right", rpmLabel: string): string {
  const s = e.stations, w = 52;
  const lx = side === "left" ? cx - w - 14 : cx + w + 14, anchor = side === "left" ? "end" : "start";
  const L = (y: number, a: string, b?: string) => text(lx, y, a, { anchor, size: 13, weight: 600 }) + (b ? text(lx, y + 15, b, { anchor, size: 11, color: COLORS.dim }) : "");
  const plume = e.flameout ? 0 : clamp01(0.25 + 0.75 * e.afterburnerFraction);
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
    <defs><radialGradient id="plume-${side}" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#fff2b0" stop-opacity="${plume}"/><stop offset="0.45" stop-color="${e.afterburnerLit ? "#ff7a1a" : "#c0581a"}" stop-opacity="${plume * 0.9}"/><stop offset="1" stop-color="#b8860b" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="${cx}" cy="${top + 300}" rx="${exitW / 2 + 6}" ry="${60 + 50 * e.afterburnerFraction}" fill="url(#plume-${side})"/>
    <path d="M${cx - exitW / 2},${top + 330} l-6,24 M${cx + exitW / 2},${top + 330} l6,24" stroke="#ccc" stroke-width="2"/>
    ${L(top + 14, rpmLabel, `${num(e.spoolSpeed * 100, 1)} % spool`)}
    ${L(top + 52, `${num(e.airflowKgS, 1)} kg/s`, `T2 ${degC(s?.Tt2K)} · P2 ${num((s?.pt2Pa ?? Number.NaN) / 1000, 0)} kPa`)}
    ${L(top + 100, `T3 ${degC(s?.Tt3K)}`, `P3 ${num((s?.pt3Pa ?? Number.NaN) / 1e5, 1)} bar · PR ${num((s?.pt3Pa ?? Number.NaN) / (s?.pt2Pa ?? Number.NaN), 1)}:1`)}
    ${L(top + 152, `TIT ${degC(s?.Tt4K)}`, `f/a ${num((s?.fuelAirRatio ?? Number.NaN) * 1000, 1)} g/kg`)}
    ${L(top + 192, `T5 ${degC(s?.Tt5K)}`, e.exhaustGasTemperatureK !== undefined ? `EGT ${degC(e.exhaustGasTemperatureK)}` : `mixer ${degC(s?.Tt6K)}`)}
    ${L(top + 262, `T7 ${degC(s?.Tt7K)}`, `${e.afterburnerLit ? "AB " + num(e.afterburnerFraction * 100) + " %" : "AB off"} · noz ${Number.isFinite(e.nozzle.position) ? num(e.nozzle.position * 100) + " %" : "fixed"}`)}
    ${L(top + 340, `${num(e.netThrustN / 1000, 1)} kN`, `${num(e.fuelFlowKgS * 3600)} kg/h`)}
    ${e.flameout ? text(cx, top + 290, "FLAMEOUT", { anchor: "middle", size: 12, color: COLORS.warn, weight: 700 }) : ""}`;
}

/** Wrap a page body in an SVG canvas. */
export function svg(width: number, height: number, body: string): string {
  return `<svg class="efb-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace, Menlo, Consolas, monospace">${body}</svg>`;
}
