export type ModuleKind =
  | "aircraft" | "ground-vehicle" | "infantry" | "naval-unit" | "weapon" | "sensor"
  | "physics-service" | "simulation-service" | "world-content" | "campaign" | "asset-pack" | "ui";

export interface ModuleCapability {
  readonly id: string;
  readonly apiVersion: string;
  readonly description?: string;
}
export interface RequiredModuleDependency {
  readonly capabilityId: string;
  readonly versionRange: string;
  readonly optional: false;
  readonly providerModuleId?: string;
  readonly degradedBehavior?: never;
}
export interface OptionalModuleDependency {
  readonly capabilityId: string;
  readonly versionRange: string;
  readonly optional: true;
  readonly providerModuleId?: string;
  readonly degradedBehavior: string;
}
export type ModuleDependency = RequiredModuleDependency | OptionalModuleDependency;

export interface ModuleConfigurationReference {
  readonly id: string;
  readonly path: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly required?: boolean;
}
export interface ModuleVariant {
  readonly family?: string;
  readonly designation?: string;
  readonly revision?: string;
  readonly operatorBaseline?: string;
  readonly effectiveDate?: string;
  /** The manifest schema permits domain-specific descriptive metadata. */
  readonly [key: string]: unknown;
}
export interface ModuleComponentReference {
  readonly role: string;
  readonly moduleId: string;
  readonly configurationId?: string;
  readonly optional?: boolean;
}
export interface ModuleAssetReference {
  readonly id: string;
  readonly path: string;
  readonly sha256?: string;
  readonly license?: string;
}
export interface ModuleLifecycle {
  readonly initialization?: "eager" | "lazy" | "scenario-load";
  readonly updateDomain?: "fixed-tick" | "event-driven" | "scheduled" | "presentation-only" | "static-data";
  readonly deterministic?: boolean;
  readonly supportsSaveState?: boolean;
}
export interface ModuleProvenance {
  readonly maintainer?: string;
  readonly source?: string;
  readonly license?: string;
  readonly notes?: string;
}
export interface ModuleManifest {
  readonly manifestSchemaVersion: 1;
  readonly id: string;
  readonly kind: ModuleKind;
  readonly name: string;
  readonly version: string;
  readonly apiCompatibility: {
    readonly minimum: string;
    readonly maximumExclusive: string | null;
  };
  readonly variant?: ModuleVariant;
  readonly provides: readonly ModuleCapability[];
  readonly dependencies: readonly ModuleDependency[];
  readonly configuration: readonly ModuleConfigurationReference[];
  readonly components?: readonly ModuleComponentReference[];
  readonly assets?: readonly ModuleAssetReference[];
  readonly lifecycle?: ModuleLifecycle;
  readonly provenance?: ModuleProvenance;
}
