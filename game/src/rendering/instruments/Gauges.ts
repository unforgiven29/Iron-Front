/**
 * Round cockpit instruments drawn on a 2D canvas (presentation only; owner: rendering).
 * Platform-neutral: an aircraft package describes each face as data (InstrumentFace) and supplies
 * the values from its snapshot. A value that is not finite means "no valid signal" (e.g. the
 * instrument has no power) and the gauge shows an OFF flag instead of a needle. Never a made-up value.
 */

export interface DialBand { readonly from: number; readonly to: number; readonly color: string }

export type InstrumentFace =
  | {
      readonly kind: "dial";
      readonly label: string;
      readonly unit: string;
      readonly min: number;
      readonly max: number;
      readonly majorStep: number;
      readonly minorStep?: number;
      /** Scale numbers are value / labelDivisor (e.g. 100 for "×100"). Default 1. */
      readonly labelDivisor?: number;
      /** Angle of `min`, degrees clockwise from 12 o'clock, and the sweep to `max`. Defaults −135 / 270. */
      readonly startDeg?: number;
      readonly sweepDeg?: number;
      /** True: the scale is one revolution that wraps (e.g. an altimeter's 1,000 m pointer). */
      readonly wrap?: boolean;
      readonly bands?: readonly DialBand[];
      /** Labels for multiple needles (values[i] drives needle i), e.g. ["L", "R"]. Default one needle. */
      readonly needles?: readonly string[];
      /** Optional digital readout under the hub: format of values[readoutIndex ?? 0]. */
      readonly readout?: { readonly index?: number; readonly divisor?: number; readonly digits?: number; readonly suffix?: string };
    }
  | {
      /** Attitude indicator: values [pitchDeg, rollDeg]. */
      readonly kind: "attitude";
      readonly label: string;
    };

const NEEDLE_COLORS = ["#f2f2f2", "#ffcc33", "#7fd4ff"];

/** Draw `face` with `values` into a square canvas context of `size` pixels. */
export function drawInstrument(g: CanvasRenderingContext2D, size: number, face: InstrumentFace, values: readonly number[]): void {
  const c = size / 2, r = size * 0.46;
  g.save();
  g.clearRect(0, 0, size, size);
  g.fillStyle = "#151719";
  g.fillRect(0, 0, size, size);
  if (face.kind === "attitude") drawAttitude(g, c, r, values);
  else drawDial(g, c, r, face, values);
  // Bezel.
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.lineWidth = size * 0.025;
  g.strokeStyle = "#5a5f66";
  g.stroke();
  g.restore();
}

function angleOf(face: Extract<InstrumentFace, { kind: "dial" }>, v: number): number {
  const start = face.startDeg ?? -135, sweep = face.sweepDeg ?? 270;
  let f = (v - face.min) / (face.max - face.min);
  f = face.wrap ? ((f % 1) + 1) % 1 : Math.max(-0.02, Math.min(1.02, f));
  return ((start + sweep * f) * Math.PI) / 180;
}

function drawDial(g: CanvasRenderingContext2D, c: number, r: number, face: Extract<InstrumentFace, { kind: "dial" }>, values: readonly number[]): void {
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fillStyle = "#0b0c0d";
  g.fill();
  const polar = (a: number, rad: number): [number, number] => [c + rad * Math.sin(a), c - rad * Math.cos(a)];
  // Colour bands.
  for (const b of face.bands ?? []) {
    const a0 = angleOf(face, b.from) - Math.PI / 2, a1 = angleOf(face, b.to) - Math.PI / 2;
    g.beginPath();
    g.arc(c, c, r * 0.86, a0, a1);
    g.lineWidth = r * 0.08;
    g.strokeStyle = b.color;
    g.stroke();
  }
  // Ticks and numbers.
  const last = face.wrap ? face.max - 1e-9 : face.max + 1e-9;
  const minor = face.minorStep;
  if (minor) for (let v = face.min; v <= last; v += minor) {
    const a = angleOf(face, v);
    const [x0, y0] = polar(a, r * 0.92), [x1, y1] = polar(a, r * 0.84);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = r * 0.015; g.strokeStyle = "#cfd3d8"; g.stroke();
  }
  g.fillStyle = "#f2f2f2";
  g.font = `bold ${Math.round(r * 0.16)}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let v = face.min; v <= last; v += face.majorStep) {
    const a = angleOf(face, v);
    const [x0, y0] = polar(a, r * 0.95), [x1, y1] = polar(a, r * 0.78);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = r * 0.035; g.strokeStyle = "#f2f2f2"; g.stroke();
    const [tx, ty] = polar(a, r * 0.62);
    g.fillText(`${+(v / (face.labelDivisor ?? 1)).toFixed(1)}`, tx, ty);
  }
  // Label and unit.
  g.font = `bold ${Math.round(r * 0.15)}px ui-monospace, Menlo, monospace`;
  g.fillStyle = "#9ad0ff";
  g.fillText(face.label, c, c - r * 0.3);
  g.font = `${Math.round(r * 0.12)}px ui-monospace, Menlo, monospace`;
  g.fillStyle = "#8a8d91";
  g.fillText(face.unit, c, c + r * 0.28);
  const needles = face.needles ?? [""];
  const valid = needles.map((_, i) => Number.isFinite(values[i] ?? Number.NaN));
  // Digital readout.
  const ro = face.readout;
  if (ro) {
    const v = values[ro.index ?? 0];
    g.font = `bold ${Math.round(r * 0.17)}px ui-monospace, Menlo, monospace`;
    g.fillStyle = "#f2f2f2";
    g.fillText(v !== undefined && Number.isFinite(v) ? `${(v / (ro.divisor ?? 1)).toFixed(ro.digits ?? 0)}${ro.suffix ?? ""}` : "---", c, c + r * 0.48);
  }
  // Needles (with their labels near the tip when there are several).
  needles.forEach((label, i) => {
    if (!valid[i]) return;
    const a = angleOf(face, values[i]!);
    const [x, y] = polar(a, r * 0.8), [bx, by] = polar(a + Math.PI, r * 0.12);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(x, y);
    g.lineWidth = r * 0.05; g.lineCap = "round"; g.strokeStyle = NEEDLE_COLORS[i % NEEDLE_COLORS.length]!; g.stroke();
    if (label) {
      const [lx, ly] = polar(a, r * 0.5);
      g.font = `bold ${Math.round(r * 0.13)}px ui-monospace, Menlo, monospace`;
      g.fillStyle = NEEDLE_COLORS[i % NEEDLE_COLORS.length]!;
      g.fillText(label, lx, ly);
    }
  });
  g.beginPath(); g.arc(c, c, r * 0.07, 0, Math.PI * 2); g.fillStyle = "#3a3d41"; g.fill();
  if (!valid.some(Boolean)) offFlag(g, c, r);
}

function drawAttitude(g: CanvasRenderingContext2D, c: number, r: number, values: readonly number[]): void {
  const [pitch, roll] = values;
  g.save();
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.clip();
  if (pitch === undefined || roll === undefined || !Number.isFinite(pitch) || !Number.isFinite(roll)) {
    g.fillStyle = "#2a2c2f";
    g.fillRect(c - r, c - r, 2 * r, 2 * r);
    g.restore();
    offFlag(g, c, r);
    return;
  }
  const pxPerDeg = r / 45;
  g.translate(c, c);
  g.rotate((-roll * Math.PI) / 180);
  const horizon = pitch * pxPerDeg;
  g.fillStyle = "#3b7fc4"; // sky
  g.fillRect(-2 * r, -3 * r + horizon, 4 * r, 3 * r);
  g.fillStyle = "#6b4a2b"; // ground
  g.fillRect(-2 * r, horizon, 4 * r, 3 * r);
  g.strokeStyle = "#f2f2f2";
  g.fillStyle = "#f2f2f2";
  g.lineWidth = r * 0.02;
  g.beginPath(); g.moveTo(-2 * r, horizon); g.lineTo(2 * r, horizon); g.stroke();
  g.font = `${Math.round(r * 0.11)}px ui-monospace, Menlo, monospace`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  for (let p = -60; p <= 60; p += 10) {
    if (p === 0) continue;
    const y = horizon - p * pxPerDeg, w = p % 20 === 0 ? r * 0.4 : r * 0.22;
    g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y); g.stroke();
    if (p % 20 === 0) g.fillText(`${Math.abs(p)}`, w / 2 + 4, y);
  }
  g.restore();
  // Fixed aircraft symbol and roll pointer.
  g.strokeStyle = "#ffcc33";
  g.lineWidth = r * 0.05;
  g.beginPath(); g.moveTo(c - r * 0.5, c); g.lineTo(c - r * 0.15, c); g.lineTo(c, c + r * 0.1); g.lineTo(c + r * 0.15, c); g.lineTo(c + r * 0.5, c); g.stroke();
  g.fillStyle = "#ffcc33";
  g.beginPath(); g.moveTo(c, c - r * 0.92); g.lineTo(c - r * 0.06, c - r * 0.8); g.lineTo(c + r * 0.06, c - r * 0.8); g.fill();
}

function offFlag(g: CanvasRenderingContext2D, c: number, r: number): void {
  g.fillStyle = "#d33";
  g.fillRect(c - r * 0.32, c - r * 0.12, r * 0.64, r * 0.24);
  g.fillStyle = "#fff";
  g.font = `bold ${Math.round(r * 0.17)}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("OFF", c, c);
}
