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
