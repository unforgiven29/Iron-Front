import {
  computeAugmentedProportionalNavigation,
  computeProportionalNavigation,
  computePurePursuitCommand,
  type GuidanceStateEstimate,
  type ProportionalNavigationConfiguration
} from "../physics/guidance/GuidanceLaws.js";
import {
  computeMissile6DofFinCommands,
  type MissileFinControllerConfiguration
} from "../physics/guidance/Missile6DofController.js";
import {
  stepMissile6Dof,
  type Missile6DofEnvironment,
  type Missile6DofModel,
  type Missile6DofState
} from "../physics/ballistics/Missile6DofDynamics.js";

export type Missile6DofGuidanceMethod =
  | "proportional-navigation"
  | "augmented-proportional-navigation"
  | "pure-pursuit";

export interface Missile6DofSimulationInput {
  readonly deltaTimeSeconds: number;
  readonly guidanceEstimate: GuidanceStateEstimate;
  readonly guidanceMethod: Missile6DofGuidanceMethod;
  readonly guidanceConfiguration: ProportionalNavigationConfiguration;
  readonly controllerConfiguration: MissileFinControllerConfiguration;
  readonly controlAuthorityFraction?: number;
}

export interface Missile6DofSimulationResult {
  readonly state: Missile6DofState;
  readonly guidanceValid: boolean;
  readonly guidanceReason: string;
  readonly commandedAccelerationWorldMps2: readonly [number, number, number];
  readonly finCommandsRad: readonly [number, number, number];
  readonly controlAvailable: boolean;
  readonly diagnostics: ReturnType<typeof stepMissile6Dof>["diagnostics"];
}

/** End-to-end estimate → guidance law → fin controller → 6-DoF rigid-body step. */
export function stepGuidedMissile6Dof(
  previous: Missile6DofState,
  model: Missile6DofModel,
  environment: Missile6DofEnvironment,
  input: Missile6DofSimulationInput
): Missile6DofSimulationResult {
  const guidance = input.guidanceMethod === "augmented-proportional-navigation"
    ? computeAugmentedProportionalNavigation(input.guidanceEstimate, input.guidanceConfiguration)
    : input.guidanceMethod === "pure-pursuit"
      ? computePurePursuitCommand(input.guidanceEstimate, input.guidanceConfiguration)
      : computeProportionalNavigation(input.guidanceEstimate, input.guidanceConfiguration);
  const controlAuthorityFraction = input.controlAuthorityFraction ?? 1;
  const finController = computeMissile6DofFinCommands(
    previous,
    model,
    environment,
    guidance.commandedAccelerationWorldMps2,
    input.controllerConfiguration,
    controlAuthorityFraction
  );
  const dynamics = stepMissile6Dof(previous, model, environment, {
    deltaTimeSeconds: input.deltaTimeSeconds,
    commandedFinDeflectionsRad: finController.finCommandsRad,
    controlAuthorityFraction
  });
  return {
    state: dynamics.state,
    guidanceValid: guidance.valid,
    guidanceReason: guidance.reason,
    commandedAccelerationWorldMps2: guidance.commandedAccelerationWorldMps2,
    finCommandsRad: finController.finCommandsRad,
    controlAvailable: finController.controlAvailable,
    diagnostics: dynamics.diagnostics
  };
}
