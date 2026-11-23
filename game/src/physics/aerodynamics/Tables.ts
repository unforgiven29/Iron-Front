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

/**
 * N-dimensional table, first axis varying fastest:
 * index = i0 + n0·(i1 + n1·(i2 + …)).
 */
export interface TableND {
  readonly axes: readonly (readonly number[])[];
  readonly values: Float64Array | readonly number[];
}

export function validateTableND(t: TableND, name = "table"): void {
  if (t.axes.length === 0) throw new RangeError(`${name} needs at least one axis.`);
  t.axes.forEach((a, i) => checkAxis(a, `${name} axis ${i}`));
  const size = t.axes.reduce((n, a) => n * a.length, 1);
  if (t.values.length !== size) throw new RangeError(`${name} has ${t.values.length} values; its axes need ${size}.`);
  for (const v of t.values) if (!Number.isFinite(v)) throw new RangeError(`${name} contains a non-finite value.`);
}

/** Multilinear interpolation, clamped at each axis edge (reported, never extrapolated). */
export function lookupND(t: TableND, inputs: readonly number[]): Lookup {
  if (inputs.length !== t.axes.length) throw new RangeError(`Expected ${t.axes.length} inputs, got ${inputs.length}.`);
  const loc = t.axes.map((axis, i) => locate(axis, inputs[i] as number));
  const clamped = loc.some((l) => l.clamped);
  const strides: number[] = [];
  let stride = 1;
  for (const axis of t.axes) { strides.push(stride); stride *= axis.length; }
  let value = 0;
  const corners = 1 << t.axes.length;
  for (let c = 0; c < corners; c++) {
    let weight = 1, index = 0;
    for (let d = 0; d < t.axes.length; d++) {
      const { i, f } = loc[d] as { i: number; f: number };
      const upper = (c >> d) & 1;
      weight *= upper ? f : 1 - f;
      index += (i + upper) * (strides[d] as number);
    }
    if (weight !== 0) value += weight * (t.values[index] as number);
  }
  return { value, clamped };
}
