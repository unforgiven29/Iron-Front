/**
 * F-16 aerodynamic coefficient tables — PROVISIONAL dataset.
 *
 * Source: NASA TP-1538, Nguyen, Ogburn, Gilbert, Kibler, Brown & Deal, "Simulator Study of
 * Stall/Post-Stall Characteristics of a Fighter Airplane With Relaxed Longitudinal Static
 * Stability" (1979), low-speed wind-tunnel data, as reduced to the low-fidelity tables in
 * B. L. Stevens & F. L. Lewis, "Aircraft Control and Simulation" (2nd ed., 2003), Appendix A.
 * Transcribed programmatically from the public University of Minnesota nlplant/lofi_F16_AeroData
 * implementation of those tables and cross-checked against the Stevens & Lewis trim point
 * (see tests).
 *
 * APPLICABILITY (read before use):
 * - Early F-16 configuration wind-tunnel data. NOT a Block 50 coefficient set. The repository's
 *   F-16C Block 50 dossier records this explicitly; the dataset is used here as a labelled
 *   provisional placeholder until Block 50 data is available.
 * - Low-speed data: valid envelope alpha -10..45 deg, |beta| <= 30 deg, elevator -24..24 deg,
 *   Mach effects NOT represented (treat results above about Mach 0.6 as unvalidated).
 * - Leading-edge flap, trailing-edge flap, speedbrake, gear and store effects are NOT in this
 *   low-fidelity set and are therefore not modelled.
 *
 * Known source discrepancy: some public copies re-index the aileron/rudder control-power tables
 * (DLDA, DLDR, DNDA, DNDR) on |beta| 0..30 step 5. The original Stevens & Lewis code indexes them
 * on signed beta -30..30 step 10, which is followed here. Status: disputed until checked
 * against the primary report.
 *
 * Axes: body FRD stability-derivative convention of the source. CX, CY, CZ are body-axis force
 * coefficients; Cl, Cm, Cn are rolling, pitching and yawing moment coefficients.
 */
import type { Table1D, Table2D } from "../../../physics/aerodynamics/Tables.js";

export const F16_AERO_PROVENANCE = Object.freeze({
  status: "secondary-reported" as const,
  applicability: "Early F-16 configuration, low-speed wind tunnel; not F-16C Block 50 specific",
  source: "NASA TP-1538 (1979) via Stevens & Lewis (2003) App. A low-fidelity tables",
  envelope: { alphaDeg: [-10, 45], betaAbsDeg: 30, elevatorDeg: [-24, 24], machMax: 0.6 },
  reviewStatus: "provisional — awaiting Block 50 data"
});

const ALPHA_DEG = [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45] as const;
const ELEVATOR_DEG = [-24, -12, 0, 12, 24] as const;
const BETA_ABS_DEG = [0, 5, 10, 15, 20, 25, 30] as const;
const BETA_SIGNED_DEG = [-30, -20, -10, 0, 10, 20, 30] as const;

const a1 = (values: readonly number[]): Table1D => ({ breakpoints: ALPHA_DEG, values });

/** Rate-damping derivatives vs alpha (deg), per radian of non-dimensional rate. */
export const DAMPING = Object.freeze({
  cxq: a1([-0.267, 0.11, 0.308, 1.34, 2.08, 2.91, 2.76, 2.05, 1.5, 1.49, 1.83, 1.21]),
  cyr: a1([0.882, 0.852, 0.876, 0.958, 0.962, 0.974, 0.819, 0.483, 0.59, 1.21, -0.493, -1.04]),
  cyp: a1([-0.108, -0.108, -0.188, 0.11, 0.258, 0.226, 0.344, 0.362, 0.611, 0.529, 0.298, -2.27]),
  czq: a1([-8.8, -25.8, -28.9, -31.4, -31.2, -30.7, -27.7, -28.2, -29.0, -29.8, -38.3, -35.3]),
  clr: a1([-0.126, -0.026, 0.063, 0.113, 0.208, 0.23, 0.319, 0.437, 0.68, 0.1, 0.447, -0.33]),
  clp: a1([-0.36, -0.359, -0.443, -0.42, -0.383, -0.375, -0.329, -0.294, -0.23, -0.21, -0.12, -0.1]),
  cmq: a1([-7.21, -0.54, -5.23, -5.26, -6.11, -6.64, -5.69, -6.0, -6.2, -6.4, -6.6, -6.0]),
  cnr: a1([-0.38, -0.363, -0.378, -0.386, -0.37, -0.453, -0.55, -0.582, -0.595, -0.637, -1.02, -0.84]),
  cnp: a1([0.061, 0.052, 0.052, -0.012, -0.013, -0.024, 0.05, 0.15, 0.13, 0.158, 0.24, 0.15]),
});

/** Body X-force coefficient: rows elevator (deg), columns alpha (deg). */
export const CX: Table2D = {
  rows: ELEVATOR_DEG,
  columns: ALPHA_DEG,
  values: [
      [-0.099, -0.081, -0.081, -0.063, -0.025, 0.044, 0.097, 0.113, 0.145, 0.167, 0.174, 0.166],
      [-0.048, -0.038, -0.04, -0.021, 0.016, 0.083, 0.127, 0.137, 0.162, 0.177, 0.179, 0.167],
      [-0.022, -0.02, -0.021, -0.004, 0.032, 0.094, 0.128, 0.13, 0.154, 0.161, 0.155, 0.138],
      [-0.04, -0.038, -0.039, -0.025, 0.006, 0.062, 0.087, 0.085, 0.1, 0.11, 0.104, 0.091],
      [-0.083, -0.073, -0.076, -0.072, -0.046, 0.012, 0.024, 0.025, 0.043, 0.053, 0.047, 0.04]
    ]
};

/** Pitching moment coefficient (about the 0.35 c reference CG): rows elevator, columns alpha. */
export const CM: Table2D = {
  rows: ELEVATOR_DEG,
  columns: ALPHA_DEG,
  values: [
      [0.205, 0.168, 0.186, 0.196, 0.213, 0.251, 0.245, 0.238, 0.252, 0.231, 0.198, 0.192],
      [0.081, 0.077, 0.107, 0.11, 0.11, 0.141, 0.127, 0.119, 0.133, 0.108, 0.081, 0.093],
      [-0.046, -0.02, -0.009, -0.005, -0.006, 0.01, 0.006, -0.001, 0.014, 0.0, -0.013, 0.032],
      [-0.174, -0.145, -0.121, -0.127, -0.129, -0.102, -0.097, -0.113, -0.087, -0.084, -0.069, -0.006],
      [-0.259, -0.202, -0.184, -0.193, -0.199, -0.15, -0.16, -0.167, -0.104, -0.076, -0.041, -0.005]
    ]
};

/** Body Z-force coefficient base vs alpha; total CZ = CZ0(a)(1-(b/57.3)^2) - 0.19 de/25. */
export const CZ0: Table1D = a1([0.77, 0.241, -0.1, -0.416, -0.731, -1.053, -1.366, -1.646, -1.917, -2.12, -2.248, -2.229]);

/** Rolling moment due to sideslip: rows |beta| (deg), columns alpha; apply sign(beta). */
export const CL_BETA: Table2D = {
  rows: BETA_ABS_DEG,
  columns: ALPHA_DEG,
  values: [
      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      [-0.001, -0.004, -0.008, -0.012, -0.016, -0.019, -0.02, -0.02, -0.015, -0.008, -0.013, -0.015],
      [-0.003, -0.009, -0.017, -0.024, -0.03, -0.034, -0.04, -0.037, -0.016, -0.002, -0.01, -0.019],
      [-0.001, -0.01, -0.02, -0.03, -0.039, -0.044, -0.05, -0.049, -0.023, -0.006, -0.014, -0.027],
      [0.0, -0.01, -0.022, -0.034, -0.047, -0.046, -0.059, -0.061, -0.033, -0.036, -0.035, -0.035],
      [0.007, -0.01, -0.023, -0.034, -0.049, -0.046, -0.068, -0.071, -0.06, -0.058, -0.062, -0.059],
      [0.009, -0.011, -0.023, -0.037, -0.05, -0.047, -0.074, -0.079, -0.091, -0.076, -0.077, -0.076]
    ]
};

/** Yawing moment due to sideslip: rows |beta| (deg), columns alpha; apply sign(beta). */
export const CN_BETA: Table2D = {
  rows: BETA_ABS_DEG,
  columns: ALPHA_DEG,
  values: [
      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      [0.018, 0.019, 0.018, 0.019, 0.019, 0.018, 0.013, 0.007, 0.004, -0.014, -0.017, -0.033],
      [0.038, 0.042, 0.042, 0.042, 0.043, 0.039, 0.03, 0.017, 0.004, -0.035, -0.047, -0.057],
      [0.056, 0.057, 0.059, 0.058, 0.058, 0.053, 0.032, 0.012, 0.002, -0.046, -0.071, -0.073],
      [0.064, 0.077, 0.076, 0.074, 0.073, 0.057, 0.029, 0.007, 0.012, -0.034, -0.065, -0.041],
      [0.074, 0.086, 0.093, 0.089, 0.08, 0.062, 0.049, 0.022, 0.028, -0.012, -0.002, -0.013],
      [0.079, 0.09, 0.106, 0.106, 0.096, 0.08, 0.068, 0.03, 0.064, 0.015, 0.011, -0.001]
    ]
};

/** Rolling moment per full aileron (da/20 deg): rows beta (deg, signed; disputed indexing), columns alpha. */
export const DCL_DA: Table2D = {
  rows: BETA_SIGNED_DEG,
  columns: ALPHA_DEG,
  values: [
      [-0.041, -0.052, -0.053, -0.056, -0.05, -0.056, -0.082, -0.059, -0.042, -0.038, -0.027, -0.017],
      [-0.041, -0.053, -0.053, -0.053, -0.05, -0.051, -0.066, -0.043, -0.038, -0.027, -0.023, -0.016],
      [-0.042, -0.053, -0.052, -0.051, -0.049, -0.049, -0.043, -0.035, -0.026, -0.016, -0.018, -0.014],
      [-0.04, -0.052, -0.051, -0.052, -0.048, -0.048, -0.042, -0.037, -0.031, -0.026, -0.017, -0.012],
      [-0.043, -0.049, -0.048, -0.049, -0.043, -0.042, -0.042, -0.036, -0.025, -0.021, -0.016, -0.011],
      [-0.044, -0.048, -0.048, -0.047, -0.042, -0.041, -0.02, -0.028, -0.013, -0.014, -0.011, -0.01],
      [-0.043, -0.049, -0.047, -0.045, -0.042, -0.037, -0.003, -0.013, -0.01, -0.003, -0.007, -0.008]
    ]
};

/** Rolling moment per full rudder (dr/30 deg). */
export const DCL_DR: Table2D = {
  rows: BETA_SIGNED_DEG,
  columns: ALPHA_DEG,
  values: [
      [0.005, 0.017, 0.014, 0.01, -0.005, 0.009, 0.019, 0.005, 0.0, -0.005, -0.011, 0.008],
      [0.007, 0.016, 0.014, 0.014, 0.013, 0.009, 0.012, 0.005, 0.0, 0.004, 0.009, 0.007],
      [0.013, 0.013, 0.011, 0.012, 0.011, 0.009, 0.008, 0.005, -0.002, 0.005, 0.003, 0.005],
      [0.018, 0.015, 0.015, 0.014, 0.014, 0.014, 0.014, 0.015, 0.013, 0.011, 0.006, 0.001],
      [0.015, 0.014, 0.013, 0.013, 0.012, 0.011, 0.011, 0.01, 0.008, 0.008, 0.007, 0.003],
      [0.021, 0.011, 0.01, 0.011, 0.01, 0.009, 0.008, 0.01, 0.006, 0.005, 0.0, 0.001],
      [0.023, 0.01, 0.011, 0.011, 0.011, 0.01, 0.008, 0.01, 0.006, 0.014, 0.02, 0.0]
    ]
};

/** Yawing moment per full aileron (da/20 deg). */
export const DCN_DA: Table2D = {
  rows: BETA_SIGNED_DEG,
  columns: ALPHA_DEG,
  values: [
      [0.001, -0.027, -0.017, -0.013, -0.012, -0.016, 0.001, 0.017, 0.011, 0.017, 0.008, 0.016],
      [0.002, -0.014, -0.016, -0.016, -0.014, -0.019, -0.021, 0.002, 0.012, 0.016, 0.015, 0.011],
      [-0.006, -0.008, -0.006, -0.006, -0.005, -0.008, -0.005, 0.007, 0.004, 0.007, 0.006, 0.006],
      [-0.011, -0.011, -0.01, -0.009, -0.008, -0.006, 0.0, 0.004, 0.007, 0.01, 0.004, 0.01],
      [-0.015, -0.015, -0.014, -0.012, -0.011, -0.008, -0.002, 0.002, 0.006, 0.012, 0.011, 0.011],
      [-0.024, -0.01, -0.004, -0.002, -0.001, 0.003, 0.014, 0.006, -0.001, 0.004, 0.004, 0.006],
      [-0.022, 0.002, -0.003, -0.005, -0.003, -0.001, -0.009, -0.009, -0.001, 0.003, -0.002, 0.001]
    ]
};

/** Yawing moment per full rudder (dr/30 deg). */
export const DCN_DR: Table2D = {
  rows: BETA_SIGNED_DEG,
  columns: ALPHA_DEG,
  values: [
      [-0.018, -0.052, -0.052, -0.052, -0.054, -0.049, -0.059, -0.051, -0.03, -0.037, -0.026, -0.013],
      [-0.028, -0.051, -0.043, -0.046, -0.045, -0.049, -0.057, -0.052, -0.03, -0.033, -0.03, -0.008],
      [-0.037, -0.041, -0.038, -0.04, -0.04, -0.038, -0.037, -0.03, -0.027, -0.024, -0.019, -0.013],
      [-0.048, -0.045, -0.045, -0.045, -0.044, -0.045, -0.047, -0.048, -0.049, -0.045, -0.033, -0.016],
      [-0.043, -0.044, -0.041, -0.041, -0.04, -0.038, -0.034, -0.035, -0.035, -0.029, -0.022, -0.009],
      [-0.052, -0.034, -0.036, -0.036, -0.035, -0.028, -0.024, -0.023, -0.02, -0.016, -0.01, -0.014],
      [-0.062, -0.034, -0.027, -0.028, -0.027, -0.027, -0.023, -0.023, -0.019, -0.009, -0.025, -0.01]
    ]
};

