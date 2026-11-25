/**
 * Platform-neutral display list: what an avionics package wants drawn on a HUD or a cockpit
 * screen, as plain data. Packages build display lists from their own state; the shared renderer
 * draws them. A display list never contains simulation logic, and drawing never changes state.
 *
 * Coordinate frames:
 *  - "screen": x right, y up, both in [-1, 1] across the screen (or the HUD's field box).
 *  - "angle":  body-frame look angles in radians (x = azimuth right, y = elevation up from the
 *              aircraft's x axis). Only meaningful on the HUD, where the view projects them so
 *              the symbol overlays the outside world (conformal symbology).
 */
export type DisplayFrame = "screen" | "angle";

export type DisplayPrimitive =
  | { readonly kind: "line"; readonly frame: DisplayFrame; readonly points: readonly (readonly [number, number])[]; readonly closed?: boolean; readonly dash?: boolean; readonly width?: number; readonly color?: string; /** Fill the closed polygon with this colour (then stroke with `color`). */ readonly fill?: string }
  | { readonly kind: "circle"; readonly frame: DisplayFrame; readonly at: readonly [number, number]; /** Radius in screen units (fraction of the half-size). */ readonly radius: number; readonly dash?: boolean; readonly fill?: boolean; readonly color?: string }
  | { readonly kind: "text"; readonly frame: DisplayFrame; readonly at: readonly [number, number]; readonly text: string; readonly align?: "left" | "center" | "right"; /** Text height in screen units. */ readonly size?: number; readonly color?: string };

export type DisplayList = readonly DisplayPrimitive[];

/** Maps display-list coordinates to canvas pixels. `angle` may return null (behind the viewer). */
export interface DisplayMapper {
  screen(x: number, y: number): readonly [number, number];
  angle?(az: number, el: number): readonly [number, number] | null;
  /** Pixels per screen unit (half the drawing area's height). */
  readonly unitPx: number;
}

/** Draw a display list on a 2D canvas. Unmappable points are skipped. */
export function drawDisplayList(g: CanvasRenderingContext2D, list: DisplayList, map: DisplayMapper, defaultColor: string): void {
  const P = (frame: DisplayFrame, p: readonly [number, number]) => (frame === "screen" ? map.screen(p[0], p[1]) : map.angle?.(p[0], p[1]) ?? null);
  g.save();
  g.lineCap = "round";
  for (const d of list) {
    const color = d.color ?? defaultColor;
    g.strokeStyle = color;
    g.fillStyle = color;
    if (d.kind === "line") {
      g.lineWidth = Math.max(1, (d.width ?? 1) * map.unitPx * 0.008);
      g.setLineDash(d.dash ? [map.unitPx * 0.025, map.unitPx * 0.02] : []);
      g.beginPath();
      let started = false;
      for (const p of d.points) {
        const q = P(d.frame, p);
        if (!q) { started = false; continue; }
        if (started) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
        started = true;
      }
      if (d.closed || d.fill) g.closePath();
      if (d.fill) { g.fillStyle = d.fill; g.fill(); }
      g.stroke();
    } else if (d.kind === "circle") {
      const q = P(d.frame, d.at);
      if (!q) continue;
      g.lineWidth = Math.max(1, map.unitPx * 0.008);
      g.setLineDash(d.dash ? [map.unitPx * 0.03, map.unitPx * 0.025] : []);
      g.beginPath();
      g.arc(q[0], q[1], Math.max(1, d.radius * map.unitPx), 0, Math.PI * 2);
      if (d.fill) g.fill(); else g.stroke();
    } else {
      const q = P(d.frame, d.at);
      if (!q) continue;
      g.setLineDash([]);
      g.font = `600 ${Math.max(8, Math.round((d.size ?? 0.06) * map.unitPx))}px ui-monospace, Menlo, monospace`;
      g.textAlign = d.align ?? "left";
      g.textBaseline = "middle";
      g.fillText(d.text, q[0], q[1]);
    }
  }
  g.restore();
}
