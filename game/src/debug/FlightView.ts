/**
 * Debug flight view: a hand-drawn 2D-canvas perspective of the synthetic terrain plus a HUD.
 * Presentation only. It reads DebugFlyer snapshots and the terrain query API, and sends control
 * commands. This is a throwaway debug view, not the project's renderer (Stage 4 selects that).
 */
import type { Quaternion, Vector3 } from "../core/coordinates/CoordinateFrames.js";
import { rotateVector } from "../physics/rigidbody/RigidBody.js";
import { DebugFlyer, type FlyerSnapshot } from "./DebugFlyer.js";

const DEG = 180 / Math.PI;
const GRID_STEP_M = 300;
const GRID_RADIUS_M = 9000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const toBody = (q: Quaternion, v: Vector3): Vector3 => rotateVector([-q[0], -q[1], -q[2], q[3]], v);

export function mountFlightView(parent: HTMLElement): void {
  const flyer = new DebugFlyer();
  const section = el("section", "panel flight");
  section.setAttribute("aria-label", "Debug flight");
  const head = el("div", "monitor-head");
  const titles = el("div");
  titles.append(
    el("p", "panel-label", "DEBUG FLIGHT · PHYSICS TEST"),
    el("p", "panel-note", "Fictional test airframe (synthetic numbers, not a real aircraft) on synthetic terrain. Uses the real rigid-body integrator, ISO 2533 atmosphere, wind and terrain queries at 120 Hz.")
  );
  const resetBtn = el("button", "ghost", "Reset (R)");
  resetBtn.type = "button";
  head.append(titles, resetBtn);

  const frame = el("div", "flight-frame");
  const canvas = el("canvas", "flight-canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Flight view. Click, then use the keyboard to fly.");
  const hint = el("p", "flight-hint", "Click here to fly");
  frame.append(canvas, hint);
  const help = el("p", "panel-note flight-help",
    "Keys: W/S or ↑/↓ pitch · A/D or ←/→ roll · Q/E yaw · Shift/Ctrl throttle up/down · R reset");
  section.append(head, frame, help);
  parent.append(section);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available.");

  // ---------- input: held keys ramp the stick, released keys centre it ----------
  const held = new Set<string>();
  let stick = { pitch: 0, roll: 0, yaw: 0 };
  let throttle = flyer.snapshot().controls.throttle;
  const keys = (k: string) => held.has(k);
  canvas.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "r") { flyer.reset(); throttle = flyer.snapshot().controls.throttle; stick = { pitch: 0, roll: 0, yaw: 0 }; return; }
    held.add(k);
  });
  canvas.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  canvas.addEventListener("blur", () => held.clear());
  canvas.addEventListener("focus", () => { hint.hidden = true; });
  canvas.addEventListener("blur", () => { hint.hidden = false; });
  resetBtn.addEventListener("click", () => { flyer.reset(); throttle = flyer.snapshot().controls.throttle; canvas.focus(); });

  const updateInput = (dt: number): void => {
    const toward = (v: number, target: number, rate: number) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));
    const axis = (pos: boolean, neg: boolean) => (pos ? 1 : 0) - (neg ? 1 : 0);
    // Stick back (nose up) with S / ArrowDown, like a real stick.
    stick = {
      pitch: toward(stick.pitch, 0.6 * axis(keys("s") || keys("arrowdown"), keys("w") || keys("arrowup")), 2.5),
      roll: toward(stick.roll, axis(keys("d") || keys("arrowright"), keys("a") || keys("arrowleft")), 3),
      yaw: toward(stick.yaw, axis(keys("e"), keys("q")), 3)
    };
    if (keys("shift")) throttle = Math.min(1, throttle + 0.5 * dt);
    if (keys("control")) throttle = Math.max(0, throttle - 0.5 * dt);
    flyer.setControls({ ...stick, throttle });
  };

  // ---------- drawing ----------
  const resize = (): { w: number; h: number } => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  };

  const draw = (s: FlyerSnapshot): void => {
    const { w, h } = resize();
    const f = w * 0.9; // focal length in px (~58° horizontal FOV)
    const cx = w / 2, cy = h / 2;
    const q = s.bodyToWorld;
    const project = (worldDir: Vector3): [number, number] | null => {
      const b = toBody(q, worldDir);
      return b[0] > 0.01 ? [cx + (f * b[1]) / b[0], cy + (f * b[2]) / b[0]] : null;
    };

    // Sky / ground split along the true horizon.
    ctx.fillStyle = "#6f97b8";
    ctx.fillRect(0, 0, w, h);
    const fwd = rotateVector(q, [1, 0, 0]);
    const hl = Math.hypot(fwd[0], fwd[1]) || 1;
    const hx = fwd[0] / hl, hy = fwd[1] / hl;
    const a = project([hx + 3 * hy, hy - 3 * hx, 0]), b = project([hx - 3 * hy, hy + 3 * hx, 0]);
    const below = project([hx, hy, -0.4]);
    ctx.fillStyle = "#3e4a36";
    if (a && b) {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if (below && (below[0] - a[0]) * nx + (below[1] - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
      const big = 4 * (w + h);
      ctx.beginPath();
      ctx.moveTo(a[0] - (dx / len) * big, a[1] - (dy / len) * big);
      ctx.lineTo(a[0] + (dx / len) * big, a[1] + (dy / len) * big);
      ctx.lineTo(a[0] + (dx / len) * big + nx * big, a[1] + (dy / len) * big + ny * big);
      ctx.lineTo(a[0] - (dx / len) * big + nx * big, a[1] - (dy / len) * big + ny * big);
      ctx.fill();
    } else if (fwd[2] < 0) {
      ctx.fillRect(0, 0, w, h);
    }

    // Terrain grid lines around the aircraft.
    const p = s.positionEnuM;
    const gx0 = Math.round(p[0] / GRID_STEP_M) * GRID_STEP_M, gy0 = Math.round(p[1] / GRID_STEP_M) * GRID_STEP_M;
    const n = Math.round(GRID_RADIUS_M / GRID_STEP_M);
    const pts: ([number, number, number] | null)[][] = [];
    for (let j = -n; j <= n; j++) {
      const row: ([number, number, number] | null)[] = [];
      for (let i = -n; i <= n; i++) {
        const x = gx0 + i * GRID_STEP_M, y = gy0 + j * GRID_STEP_M;
        const t = flyer.terrain.sample(x, y);
        if (t.status !== "valid") { row.push(null); continue; }
        const rel: Vector3 = [x - p[0], y - p[1], t.heightM - p[2]];
        const dist = Math.hypot(rel[0], rel[1], rel[2]);
        const sp = project(rel);
        row.push(sp ? [sp[0], sp[1], dist] : null);
      }
      pts.push(row);
    }
    ctx.lineWidth = Math.max(1, w / 900);
    const segment = (u: [number, number, number] | null, v: [number, number, number] | null) => {
      if (!u || !v) return;
      const d = (u[2] + v[2]) / 2;
      const alpha = Math.max(0, 1 - d / GRID_RADIUS_M);
      if (alpha <= 0) return;
      ctx.strokeStyle = `rgba(196, 220, 170, ${(0.15 + 0.6 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(u[0], u[1]);
      ctx.lineTo(v[0], v[1]);
      ctx.stroke();
    };
    for (let j = 0; j < pts.length; j++) {
      const row = pts[j] as ([number, number, number] | null)[];
      for (let i = 0; i < row.length; i++) {
        if (i + 1 < row.length) segment(row[i] ?? null, row[i + 1] ?? null);
        if (j + 1 < pts.length) segment(row[i] ?? null, (pts[j + 1] as ([number, number, number] | null)[])[i] ?? null);
      }
    }

    // HUD.
    const hud = "#9cf5b0";
    ctx.strokeStyle = hud;
    ctx.fillStyle = hud;
    ctx.lineWidth = Math.max(1.5, w / 700);
    const u = w / 100;
    ctx.beginPath(); // waterline
    ctx.moveTo(cx - 4 * u, cy); ctx.lineTo(cx - 1.5 * u, cy); ctx.lineTo(cx - 0.75 * u, cy + 0.75 * u);
    ctx.lineTo(cx, cy); ctx.lineTo(cx + 0.75 * u, cy + 0.75 * u); ctx.lineTo(cx + 1.5 * u, cy); ctx.lineTo(cx + 4 * u, cy);
    ctx.stroke();
    if (Math.hypot(...s.velocityEnuMps) > 1) { // flight-path marker
      const fpm = project(s.velocityEnuMps);
      if (fpm) {
        ctx.beginPath(); ctx.arc(fpm[0], fpm[1], 0.8 * u, 0, Math.PI * 2);
        ctx.moveTo(fpm[0] - 2 * u, fpm[1]); ctx.lineTo(fpm[0] - 0.8 * u, fpm[1]);
        ctx.moveTo(fpm[0] + 0.8 * u, fpm[1]); ctx.lineTo(fpm[0] + 2 * u, fpm[1]);
        ctx.moveTo(fpm[0], fpm[1] - 0.8 * u); ctx.lineTo(fpm[0], fpm[1] - 1.8 * u);
        ctx.stroke();
      }
    }
    ctx.font = `600 ${Math.round(1.6 * u)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "middle";
    const left = [
      `TAS ${(s.trueAirspeedMps * 1.943844).toFixed(0)} kt`,
      `M   ${s.mach.toFixed(2)}`,
      `AOA ${(s.alphaRad * DEG).toFixed(1)}°`,
      `G   ${s.loadFactorG.toFixed(1)}`,
      `THR ${(s.controls.throttle * 100).toFixed(0)}%`
    ];
    const agl = s.ground.kind === "airborne" ? `${(s.ground.aglM * 3.28084).toFixed(0)} ft` : "----";
    const right = [
      `ALT ${(s.altitudeMslM * 3.28084).toFixed(0)} ft`,
      `AGL ${agl}`,
      `HDG ${String(Math.round((((s.headingRad * DEG) % 360) + 360) % 360) % 360).padStart(3, "0")}°`,
      `PIT ${(s.pitchRad * DEG).toFixed(1)}°`,
      `BNK ${(s.rollRad * DEG).toFixed(1)}°`
    ];
    left.forEach((t, i) => { ctx.textAlign = "left"; ctx.fillText(t, 2.5 * u, 4 * u + i * 2.6 * u); });
    right.forEach((t, i) => { ctx.textAlign = "right"; ctx.fillText(t, w - 2.5 * u, 4 * u + i * 2.6 * u); });

    const banner = (text: string, color: string) => {
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.round(2.4 * u)}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = color;
      ctx.fillText(text, cx, h - 5 * u);
    };
    if (s.ground.kind === "crashed") {
      ctx.fillStyle = "rgba(10, 12, 16, 0.6)";
      ctx.fillRect(0, 0, w, h);
      banner(`CRASHED at ${(s.ground.impactSpeedMps * 1.943844).toFixed(0)} kt — press R`, "#ffb4a8");
    } else if (s.ground.kind === "terrain-unknown") {
      banner("TERRAIN DATA UNAVAILABLE — no ground collision here", "#ffd37a");
    } else if (s.stalled) {
      banner("STALL", "#ffb4a8");
    } else if (s.ground.aglM < 150) {
      banner("PULL UP", "#ffd37a");
    }
  };

  let last: number | null = null;
  const loop = (now: number): void => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    updateInput(dt);
    flyer.advanceFrame(dt);
    draw(flyer.snapshot());
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
