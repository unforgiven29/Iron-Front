export type QualityStatus =
  | "valid"
  | "stale"
  | "invalid"
  | "unavailable"
  | "estimated"
  | "unknown";

/** Common metadata; each message kind adds its own typed payload. */
export interface MessageEnvelope {
  readonly messageId: string;
  readonly contractId: string;
  readonly contractVersion: number;
  readonly producerModuleId: string;
  readonly simulationTick: number;
  readonly simulationTimeSeconds: number;
  readonly status: QualityStatus;
  readonly entityId?: string;
  readonly frameId?: string;
  readonly correlationId?: string;
  readonly provenance?: Readonly<Record<string, unknown>>;
  readonly quality?: Readonly<Record<string, unknown>>;
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
  readonly payload: {
    readonly value: TValue;
    readonly uncertainty: TUncertainty;
  };
}

export interface ImmutableSnapshot<TState> extends MessageEnvelope {
  readonly kind: "snapshot";
  readonly payload: Readonly<TState>;
}
