/**
 * Developer debug overlay (presentation only; toggled with the ` key). Shows what the avionics
 * report about themselves and the state of every missile in flight, so the pilot can watch the
 * radar, weapon control and missile flight working. It reads published status and states only and
 * never feeds anything back into the simulation. The "truth" lines are labelled as such: they are
 * a developer view and are not available to any sensor or AI.
 */
import type { Vector3 } from "../core/coordinates/CoordinateFrames.js";

export interface DebugMissileRow {
  readonly id: string;
  readonly type: string;
  readonly side: string;
  readonly timeS: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly phase: string;
  readonly seeker: string;
  readonly extra?: string;
}

export interface DebugSource {
  readonly timeS: () => number;
  readonly ownPositionEnuM: () => Vector3;
  readonly avionics: () => Readonly<Record<string, string | number>> | null;
  readonly missiles: () => readonly DebugMissileRow[];
  readonly events: () => readonly { readonly timeS: number; readonly missileId: string; readonly kind: string; readonly detail: string }[];
  readonly truthTargets: () => readonly { readonly id: string; readonly positionEnuM: Vector3; readonly destroyed: boolean }[];
}

const fmt = (v: string | number) => (typeof v === "number" ? (Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : "—") : v || "—");
const dist = (a: Vector3, b: Vector3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Plain-text report (exported for tests). */
export function debugReport(src: DebugSource): string {
  const own = src.ownPositionEnuM();
  const lines: string[] = [`DEBUG  t=${src.timeS().toFixed(1)} s   (\` to hide)`, "", "── AVIONICS / RADAR / WEAPON CONTROL ──"];
  const st = src.avionics();
  if (!st) lines.push("  no avionics suite");
  else for (const [k, v] of Object.entries(st)) lines.push(`  ${k.padEnd(14)} ${fmt(v)}`);
  lines.push("", "── MISSILES IN FLIGHT ──");
  const ms = src.missiles();
  if (ms.length === 0) lines.push("  none");
  for (const m of ms) {
    const speed = Math.hypot(...m.velocityEnuMps);
    lines.push(`  ${m.id} ${m.type} [${m.side}] t+${m.timeS.toFixed(1)}s ${m.phase}`);
    lines.push(`     ${Math.round(speed)} m/s  alt ${Math.round(m.positionEnuM[2])} m  from own ${(dist(m.positionEnuM, own) / 1000).toFixed(1)} km  seeker ${m.seeker}${m.extra ? `  ${m.extra}` : ""}`);
  }
  lines.push("", "── WEAPON EVENTS (last 6) ──");
  const ev = src.events().slice(-6);
  if (ev.length === 0) lines.push("  none");
  for (const e of ev) lines.push(`  ${e.timeS.toFixed(1)}s ${e.missileId} ${e.kind.toUpperCase()} ${e.detail}`);
  lines.push("", "── TRUTH (developer view; not seen by sensors) ──");
  for (const t of src.truthTargets()) lines.push(`  ${t.id.padEnd(14)} ${(dist(t.positionEnuM, own) / 1000).toFixed(1)} km  alt ${Math.round(t.positionEnuM[2])} m${t.destroyed ? "  DESTROYED" : ""}`);
  return lines.join("\n");
}

export function mountDebugOverlay(frame: HTMLElement, src: DebugSource): { toggle(): void; update(): void; dispose(): void } {
  const pre = document.createElement("pre");
  pre.className = "debug-overlay";
  pre.setAttribute("aria-label", "Debug overlay");
  Object.assign(pre.style, {
    position: "absolute", top: "8px", left: "8px", margin: "0", padding: "8px 10px", maxWidth: "min(560px, 90%)", maxHeight: "85%", overflow: "auto",
    background: "rgba(0,0,0,0.72)", color: "#9ef0b0", font: "12px/1.35 ui-monospace, Menlo, monospace", pointerEvents: "none", zIndex: "5", display: "none", whiteSpace: "pre"
  });
  frame.append(pre);
  let shown = false, n = 0;
  return {
    toggle() { shown = !shown; pre.style.display = shown ? "block" : "none"; n = 0; },
    update() { if (shown && n++ % 6 === 0) pre.textContent = debugReport(src); },
    dispose() { pre.remove(); }
  };
}
