/**
 * Aircraft available to the game, loaded through the module system: each aircraft package's
 * manifest is validated and resolved, then composed from an explicit factory catalog. Adding an
 * aircraft means adding one entry here (see docs/claude/adding-an-aircraft.md).
 */
import { composeModules, type ModuleFactory } from "../core/modules/ModuleComposer.js";
import { resolveModules } from "../core/modules/ModuleResolver.js";
import type { AircraftDefinition } from "../platforms/aircraft/common/AircraftDefinition.js";
import { createF16Definition, F16_MANIFEST } from "../platforms/aircraft/f16c-block50/F16Definition.js";

export const AIRCRAFT_CAPABILITY = "platform.aircraft.definition";
export const HOST_API_VERSION = "0.1.0";

/** Registered aircraft packages: manifest + factory. */
const PACKAGES: readonly { manifest: typeof F16_MANIFEST; create: () => AircraftDefinition }[] = [
  { manifest: F16_MANIFEST, create: () => createF16Definition() }
];

export interface AircraftCatalog {
  readonly ids: readonly string[];
  definition(id: string): AircraftDefinition;
  /** Resolution problems (invalid manifests etc.), empty when all packages loaded. */
  readonly problems: readonly string[];
}

export function loadAircraftCatalog(): AircraftCatalog {
  const resolution = resolveModules({ manifests: PACKAGES.map((p) => p.manifest), hostApiVersion: HOST_API_VERSION });
  const factories = new Map<string, ModuleFactory>(PACKAGES.map((p) => [p.manifest.id, {
    create: () => ({ capabilities: { [AIRCRAFT_CAPABILITY]: p.create } })
  }]));
  const runtime = composeModules(resolution, factories);
  return {
    ids: runtime.moduleIds,
    definition: (id) => runtime.capability<() => AircraftDefinition>(id, AIRCRAFT_CAPABILITY)(),
    problems: resolution.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`)
  };
}
