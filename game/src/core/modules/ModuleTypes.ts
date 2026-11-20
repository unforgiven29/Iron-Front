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

export interface ModuleManifest {
  readonly manifestSchemaVersion: 1;
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly version: string;
  readonly apiCompatibility: {
    readonly minimum: string;
    readonly maximumExclusive: string | null;
  };
  readonly provides: readonly ModuleCapability[];
  readonly dependencies: readonly ModuleDependency[];
  readonly configuration: readonly ModuleConfigurationReference[];
}
