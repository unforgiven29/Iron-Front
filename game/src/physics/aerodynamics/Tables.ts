/**
 * Coefficient table lookup with explicit envelope reporting.
 *
 * Owner: physics/aerodynamics. Platform-neutral: aircraft packages supply the tables and decide
 * what an out-of-envelope query means for them. Outside a table's breakpoints the value is held
 * at the edge (never extrapolated), and the lookup says it was clamped so callers can flag it.
 */

export interface Table1D {
  readonly breakpoints: readonly number[];
  readonly values: readonly number[];
}

export interface Table2D {
  /** Row axis breakpoints (first index). */
  readonly rows: readonly number[];
  /** Column axis breakpoints (second index). */
  readonly columns: readonly number[];
  /** values[row][column]. */
  readonly values: readonly (readonly number[])[];
}

export interface Lookup {
  readonly value: number;
  /** True when any input lay outside its breakpoints and was held at the edge. */
  readonly clamped: boolean;
}

function checkAxis(axis: readonly number[], name: string): void {
  if (axis.length < 2) throw new RangeError(`${name} needs at least two breakpoints.`);
  for (let i = 1; i < axis.length; i++) {
    if (!((axis[i] as number) > (axis[i - 1] as number))) throw new RangeError(`${name} breakpoints must be strictly increasing.`);
  }
}

export function validateTable1D(t: Table1D, name = "table"): void {
  checkAxis(t.breakpoints, `${name} breakpoints`);
  if (t.values.length !== t.breakpoints.length || !t.values.every(Number.isFinite)) throw new RangeError(`${name} needs one finite value per breakpoint.`);
}

export function validateTable2D(t: Table2D, name = "table"): void {
  checkAxis(t.rows, `${name} rows`);
  checkAxis(t.columns, `${name} columns`);
  if (t.values.length !== t.rows.length || t.values.some((r) => r.length !== t.columns.length || !r.every(Number.isFinite))) {
    throw new RangeError(`${name} must be ${t.rows.length}x${t.columns.length} finite values.`);
  }
}

/** Index of the lower breakpoint and fraction toward the next, clamped to the axis. */
function locate(axis: readonly number[], x: number): { i: number; f: number; clamped: boolean } {
  if (!Number.isFinite(x)) throw new RangeError("Table lookup input must be finite.");
  const last = axis.length - 1;
  if (x <= (axis[0] as number)) return { i: 0, f: 0, clamped: x < (axis[0] as number) };
  if (x >= (axis[last] as number)) return { i: last - 1, f: 1, clamped: x > (axis[last] as number) };
  let i = 0;
  while ((axis[i + 1] as number) < x) i++;
  return { i, f: (x - (axis[i] as number)) / ((axis[i + 1] as number) - (axis[i] as number)), clamped: false };
}

export function lookup1D(t: Table1D, x: number): Lookup {
  const { i, f, clamped } = locate(t.breakpoints, x);
  const a = t.values[i] as number, b = t.values[i + 1] as number;
  return { value: a + (b - a) * f, clamped };
}

/** Bilinear lookup. */
export function lookup2D(t: Table2D, row: number, column: number): Lookup {
  const r = locate(t.rows, row), c = locate(t.columns, column);
  const v = t.values;
  const v00 = (v[r.i] as readonly number[])[c.i] as number, v01 = (v[r.i] as readonly number[])[c.i + 1] as number;
  const v10 = (v[r.i + 1] as readonly number[])[c.i] as number, v11 = (v[r.i + 1] as readonly number[])[c.i + 1] as number;
  const top = v00 + (v01 - v00) * c.f, bottom = v10 + (v11 - v10) * c.f;
  return { value: top + (bottom - top) * r.f, clamped: r.clamped || c.clamped };
}
