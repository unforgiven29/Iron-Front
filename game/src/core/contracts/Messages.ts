export type QualityStatus =
  | "valid"
  | "stale"
  | "invalid"
  | "unavailable"
  | "estimated"
  | "unknown";

export interface ContractVersion {
  readonly major: number;
  readonly minor: number;
}

export interface MessageEnvelope {
  readonly messageId: string;
  readonly contractId: string;
  readonly contractVersion: ContractVersion;
  readonly producerModuleId: string;
  readonly simulationTick: number;
  readonly simulationTimeSeconds: number;
  readonly entityId?: string;
  readonly frameId?: string;
  readonly correlationId?: string;
  readonly qualityStatus: QualityStatus;
  readonly provenance?: string;
}

export interface CommandMessage<TPayload> extends MessageEnvelope {
  readonly kind: "command";
  readonly issuerId: string;
  readonly targetModuleId: string;
  readonly payload: TPayload;
}

export interface DomainEvent<TPayload> extends MessageEnvelope {
  readonly kind: "event";
  readonly eventType: string;
  readonly payload: TPayload;
}

export interface Observation<TValue, TUncertainty = unknown> extends MessageEnvelope {
  readonly kind: "observation";
  readonly sourceId: string;
  readonly acquiredAtTick: number;
  readonly value: TValue;
  readonly uncertainty: TUncertainty;
}

export interface ImmutableSnapshot<TState> extends MessageEnvelope {
  readonly kind: "snapshot";
  readonly state: Readonly<TState>;
}
