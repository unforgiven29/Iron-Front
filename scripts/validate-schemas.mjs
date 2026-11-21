import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";

const ajv = new Ajv2020({ allErrors: true, strict: false });

async function readJson(path) {
  return JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
}
function validate(schema, data, label) {
  const check = ajv.compile(schema);
  if (!check(data)) {
    const detail = (check.errors ?? [])
      .map((error) => (error.instancePath || "/") + " " + (error.message ?? "invalid"))
      .join("\n");
    throw new Error(label + " failed validation:\n" + detail);
  }
  process.stdout.write("PASS " + label + "\n");
}
function reject(schema, data, label) {
  const check = ajv.compile(schema);
  if (check(data)) throw new Error(label + " unexpectedly passed schema validation.");
  process.stdout.write("PASS rejected " + label + "\n");
}

const manifestSchema = await readJson("docs/module-system/schemas/module-manifest.schema.json");
const parameterSchema = await readJson("docs/data-standards/schemas/technical-parameter.schema.json");
const measurementSchema = await readJson("docs/data-standards/schemas/measurement.schema.json");
const envelopeSchema = await readJson("docs/integration-contracts/schemas/message-envelope.schema.json");
const antennaApertureSchema = await readJson("docs/radar/schemas/antenna-aperture.schema.json");
const manifestExample = await readJson("docs/module-system/templates/module.manifest.example.json");

validate(manifestSchema, manifestExample, "module manifest example");
const missingApiUpperBound = structuredClone(manifestExample);
delete missingApiUpperBound.apiCompatibility.maximumExclusive;
reject(manifestSchema, missingApiUpperBound, "module manifest without explicit API compatibility upper bound");
const missingDegradedBehavior = structuredClone(manifestExample);
delete missingDegradedBehavior.dependencies[2].degradedBehavior;
reject(manifestSchema, missingDegradedBehavior, "optional dependency without degraded behavior");
const requiredWithDegradedBehavior = structuredClone(manifestExample);
requiredWithDegradedBehavior.dependencies[0].degradedBehavior = "Should not be present on a required dependency.";
reject(manifestSchema, requiredWithDegradedBehavior, "required dependency with optional-only degraded behavior");

validate(parameterSchema, {
  id: "example.engine.thrust",
  name: "Example engine thrust parameter",
  status: "unknown",
  value: null,
  unit: "N",
  applicability: { platform: "example" },
  provenance: { sourceType: "unknown" },
  reviewStatus: "needs-source"
}, "unknown technical parameter record");

validate(parameterSchema, {
  id: "example.mig29.loadout",
  name: "Simulator-reference MiG-29 loadout report",
  status: "simulator-reference",
  value: "2 x R-27R and 4 x R-73",
  unit: null,
  applicability: { platform: "MiG-29", variant: "product 9.13; exact fit not proven" },
  provenance: {
    sourceType: "document",
    title: "DCS MiG-29 Flight Manual",
    publisher: "Eagle Dynamics",
    url: "https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/"
  },
  reviewStatus: "needs-source",
  notes: "Simulator-only loadout evidence; not an authoritative product 9.13 clearance."
}, "simulator-reference technical parameter");
validate(parameterSchema, {
  id: "example.f16.gun-capacity",
  name: "Disputed F-16 ammunition capacity",
  status: "disputed",
  value: null,
  unit: "rounds",
  applicability: { platform: "F-16C", variant: "Block 50" },
  provenance: { sourceType: "document", title: "Conflicting public installation references" },
  reviewStatus: "disputed",
  notes: "Public sources report 500 and 511 rounds; exact selected baseline source is required."
}, "disputed technical parameter");
validate(parameterSchema, {
  id: "example.sensor.unknown",
  name: "Unknown sensor performance value",
  status: "unknown",
  value: null,
  unit: "m",
  applicability: { platform: "example" },
  provenance: { sourceType: "unknown" },
  reviewStatus: "needs-source"
}, "explicit unknown technical parameter");
reject(parameterSchema, {
  id: "example.sensor.fake",
  name: "Invalid fabricated unknown",
  status: "unknown",
  value: 123,
  unit: "m",
  applicability: { platform: "example" },
  provenance: { sourceType: "unknown" }
}, "unknown technical parameter with numeric value");
reject(parameterSchema, {
  id: "example.surface.not-fitted",
  name: "Surface declared absent",
  status: "not-fitted",
  value: 1,
  unit: "count",
  applicability: { platform: "example" },
  provenance: { sourceType: "unknown" }
}, "not-fitted parameter with non-null value");
validate(measurementSchema, {
  measurementId: "test.measurement.1",
  sourceId: "test.sensor",
  acquisitionTick: 1,
  status: "estimated",
  value: 120,
  unit: "m/s",
  frameId: "world.enu",
  quality: { confidence: 0.5, flags: ["synthetic-test"] },
  uncertainty: { standardDeviation: 5 }
}, "measurement envelope");

const commonEnvelope = {
  messageId: "test.message.1",
  contractId: "test.contract",
  contractVersion: 1,
  producerModuleId: "test.producer",
  simulationTick: 1,
  simulationTimeSeconds: 1 / 120,
  status: "valid"
};
validate(envelopeSchema, {
  ...commonEnvelope, kind: "command", issuerId: "test.cockpit",
  targetModuleId: "test.aircraft", payload: { command: "set-switch" }
}, "command message envelope");
validate(envelopeSchema, {
  ...commonEnvelope, kind: "event", eventType: "test.event", payload: { event: "test" }
}, "event message envelope");
validate(envelopeSchema, {
  ...commonEnvelope, kind: "observation", sourceId: "test.sensor", acquiredAtTick: 1,
  payload: { value: 42, uncertainty: { standardDeviation: 0.2 } }
}, "observation message envelope");
validate(envelopeSchema, {
  ...commonEnvelope, kind: "snapshot", payload: { state: "ready" }
}, "snapshot message envelope");

reject(envelopeSchema, {
  ...commonEnvelope, kind: "command", issuerId: "test.cockpit", payload: { command: "set-switch" }
}, "command without target module");
reject(envelopeSchema, {
  ...commonEnvelope, kind: "observation", sourceId: "test.sensor", payload: { value: 42 }
}, "observation without acquisition tick and uncertainty");
reject(envelopeSchema, {
  ...commonEnvelope, kind: "event", payload: { event: "test" }
}, "event without event type");

const apertureExamples = await readJson("docs/radar/examples/antenna-apertures.example.json");
for (const aperture of apertureExamples.apertures) {
  validate(antennaApertureSchema, aperture, aperture.construction + " aperture example");
}
const invalidSlottedArray = structuredClone(apertureExamples.apertures[1]);
invalidSlottedArray.geometry.phaseControl = "unlimited-electronic-steering";
reject(antennaApertureSchema, invalidSlottedArray, "slotted array with unsupported phase-control value");

process.stdout.write("All architecture data examples and negative schema cases passed.\n");
