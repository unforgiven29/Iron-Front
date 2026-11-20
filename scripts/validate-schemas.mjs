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

const manifestSchema = await readJson("docs/module-system/schemas/module-manifest.schema.json");
const parameterSchema = await readJson("docs/data-standards/schemas/technical-parameter.schema.json");
const measurementSchema = await readJson("docs/data-standards/schemas/measurement.schema.json");
const envelopeSchema = await readJson("docs/integration-contracts/schemas/message-envelope.schema.json");
const manifestExample = await readJson("docs/module-system/templates/module.manifest.example.json");

validate(manifestSchema, manifestExample, "module manifest example");
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
validate(envelopeSchema, {
  messageId: "test.message.1",
  contractId: "test.contract",
  contractVersion: 1,
  producerModuleId: "test.producer",
  simulationTick: 1,
  simulationTimeSeconds: 1 / 120,
  messageKind: "event",
  payload: { event: "test" }
}, "message envelope");

process.stdout.write("All architecture data examples passed schema validation.\n");
