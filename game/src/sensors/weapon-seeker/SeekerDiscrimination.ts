export type SeekerFeature =
  | "signalToNoiseDb"
  | "angularRateDegPerSecond"
  | "apparentAngularSizeDeg"
  | "rangeRateMps"
  | "trackContinuitySeconds"
  | "thermalDecayRatePerSecond"
  | "spectralRatio"
  | "kinematicPredictionErrorMps";

export interface SeekerFeatureObservation {
  readonly measurementId: string;
  readonly azimuthOffBoresightDeg: number;
  readonly elevationOffBoresightDeg: number;
  readonly rangeM: number;
  readonly features: Readonly<Partial<Record<SeekerFeature, number>>>;
}

export interface SeekerFeatureExpectation {
  readonly feature: SeekerFeature;
  readonly expectedMean: number;
  readonly standardDeviation: number;
  readonly weight: number;
}

export interface SeekerDiscriminationProfile {
  /** Product-specific cue model; values require exact hardware/software provenance. */
  readonly featureExpectations: readonly SeekerFeatureExpectation[];
  readonly horizontalFieldOfViewDeg: number;
  readonly verticalFieldOfViewDeg: number;
  readonly minimumRangeM: number;
  readonly maximumRangeM: number;
  readonly minimumFeatureCoverageFraction: number;
  readonly minimumRelativeTargetWeight: number;
}

export interface ScoredSeekerCandidate {
  readonly measurementId: string;
  readonly relativeTargetWeight: number;
  readonly featureCoverageFraction: number;
  readonly logLikelihoodScore: number;
  readonly accepted: boolean;
  readonly rejectedReason?: "outside-field-of-view" | "outside-range" | "insufficient-features" | "low-relative-score";
}

export interface SeekerDiscriminationResult {
  readonly candidates: readonly ScoredSeekerCandidate[];
  readonly selectedMeasurementId: string | null;
  /** This is an uncalibrated relative score, not a real-world probability of target identity. */
  readonly scoreMeaning: "uncalibrated-relative-likelihood";
}

function validateProfile(profile: SeekerDiscriminationProfile): void {
  const positive = [
    profile.horizontalFieldOfViewDeg,
    profile.verticalFieldOfViewDeg,
    profile.minimumRangeM,
    profile.maximumRangeM
  ];
  if (!positive.every((value) => Number.isFinite(value) && value > 0) ||
    profile.maximumRangeM <= profile.minimumRangeM) {
    throw new RangeError("Seeker field-of-view and range limits are invalid.");
  }
  if (!Number.isFinite(profile.minimumFeatureCoverageFraction) ||
    profile.minimumFeatureCoverageFraction < 0 || profile.minimumFeatureCoverageFraction > 1 ||
    !Number.isFinite(profile.minimumRelativeTargetWeight) ||
    profile.minimumRelativeTargetWeight < 0 || profile.minimumRelativeTargetWeight > 1) {
    throw new RangeError("Seeker discrimination thresholds must be in [0, 1].");
  }
  if (profile.featureExpectations.length === 0) throw new RangeError("At least one seeker feature expectation is required.");
  const seen = new Set<SeekerFeature>();
  for (const item of profile.featureExpectations) {
    if (!Number.isFinite(item.expectedMean) || !Number.isFinite(item.standardDeviation) ||
      item.standardDeviation <= 0 || !Number.isFinite(item.weight) || item.weight <= 0 ||
      seen.has(item.feature)) {
      throw new RangeError("Seeker feature expectations must be unique with positive finite deviation and weight.");
    }
    seen.add(item.feature);
  }
}

/**
 * Scores observations against a platform/product-specific feature envelope.
 * It never receives a target entity type or a decoy truth label. Thermal intensity
 * alone is not a lock: temporal, spectral, angular and kinematic cues can compete.
 */
export function discriminateSeekerCandidates(
  observations: readonly SeekerFeatureObservation[],
  profile: SeekerDiscriminationProfile
): SeekerDiscriminationResult {
  validateProfile(profile);
  const validScores: Array<{
    readonly observation: SeekerFeatureObservation;
    readonly score: number;
    readonly coverage: number;
    readonly rejectedReason?: ScoredSeekerCandidate["rejectedReason"];
  }> = [];

  for (const observation of observations) {
    if (!observation.measurementId ||
      ![observation.azimuthOffBoresightDeg, observation.elevationOffBoresightDeg, observation.rangeM].every(Number.isFinite) ||
      Object.values(observation.features).some((value) => value !== undefined && !Number.isFinite(value))) {
      throw new RangeError("Seeker observation contains invalid measurements.");
    }
    if (Math.abs(observation.azimuthOffBoresightDeg) > profile.horizontalFieldOfViewDeg / 2 ||
      Math.abs(observation.elevationOffBoresightDeg) > profile.verticalFieldOfViewDeg / 2) {
      validScores.push({ observation, score: -Infinity, coverage: 0, rejectedReason: "outside-field-of-view" });
      continue;
    }
    if (observation.rangeM < profile.minimumRangeM || observation.rangeM > profile.maximumRangeM) {
      validScores.push({ observation, score: -Infinity, coverage: 0, rejectedReason: "outside-range" });
      continue;
    }

    let weightedLogLikelihood = 0;
    let observedWeight = 0;
    const totalWeight = profile.featureExpectations.reduce((sum, item) => sum + item.weight, 0);
    for (const expectation of profile.featureExpectations) {
      const value = observation.features[expectation.feature];
      if (value === undefined) continue;
      const standardizedError = (value - expectation.expectedMean) / expectation.standardDeviation;
      weightedLogLikelihood += expectation.weight *
        (-0.5 * standardizedError * standardizedError - Math.log(expectation.standardDeviation));
      observedWeight += expectation.weight;
    }
    const coverage = observedWeight / totalWeight;
    if (coverage < profile.minimumFeatureCoverageFraction || observedWeight <= 0) {
      validScores.push({
        observation,
        score: -Infinity,
        coverage,
        rejectedReason: "insufficient-features"
      });
    } else {
      validScores.push({ observation, score: weightedLogLikelihood, coverage });
    }
  }

  const maximumScore = Math.max(...validScores.map((item) => item.score));
  const unnormalized = validScores.map((item) =>
    Number.isFinite(item.score) ? Math.exp(Math.max(-700, item.score - maximumScore)) : 0
  );
  const total = unnormalized.reduce((sum, value) => sum + value, 0);
  const candidates: ScoredSeekerCandidate[] = validScores.map((item, index) => {
    const relativeTargetWeight = total > 0 ? unnormalized[index]! / total : 0;
    const rejectedReason = item.rejectedReason ??
      (relativeTargetWeight < profile.minimumRelativeTargetWeight ? "low-relative-score" : undefined);
    return {
      measurementId: item.observation.measurementId,
      relativeTargetWeight,
      featureCoverageFraction: item.coverage,
      logLikelihoodScore: item.score,
      accepted: rejectedReason === undefined,
      ...(rejectedReason === undefined ? {} : { rejectedReason })
    };
  }).sort((a, b) => b.relativeTargetWeight - a.relativeTargetWeight ||
    a.measurementId.localeCompare(b.measurementId));

  return {
    candidates,
    selectedMeasurementId: candidates.find((candidate) => candidate.accepted)?.measurementId ?? null,
    scoreMeaning: "uncalibrated-relative-likelihood"
  };
}
