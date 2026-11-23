/**
 * Typed, versioned, deterministic transport for commands, events, observations and snapshots.
 *
 * Owner: game/core/events. Semantics:
 * - Every message must match a registered (contractId, contractVersion, kind) contract and
 *   pass envelope schema validation plus the contract's payload validator.
 * - Publishing only queues. `deliver()` drains the queue in publish order; messages published
 *   by consumers during delivery wait for the next `deliver()` call (no re-entrancy).
 * - Commands go only to the single handler of `targetModuleId`, which accepts or rejects.
 * - Events, observations and snapshots go to every subscriber of that contract, in subscriber-id order.
 * - Consumers receive only contracts they subscribed to. Snapshot payloads are deep-frozen.
 * - A message stamped with a tick other than the bus's current tick is rejected.
 */
import Ajv2020 from "ajv/dist/2020.js";
import envelopeSchema from "../../../../docs/integration-contracts/schemas/message-envelope.schema.json";
import type { CommandMessage, DomainEvent, ImmutableSnapshot, Observation } from "../contracts/Messages.js";

export type AnyMessage = CommandMessage<unknown> | DomainEvent<unknown> | Observation<unknown> | ImmutableSnapshot<unknown>;
export type MessageKind = AnyMessage["kind"];

export interface MessageContract {
  readonly contractId: string;
  readonly contractVersion: number;
  readonly kind: MessageKind;
  /** Returns a list of problems; empty means valid. */
  readonly validatePayload?: (payload: unknown) => readonly string[];
}

export type CommandDecision = { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

export interface CommandOutcome {
  readonly messageId: string;
  readonly contractId: string;
  readonly targetModuleId: string;
  readonly tick: number;
  readonly accepted: boolean;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface ConsumerFault {
  readonly messageId: string;
  readonly consumerId: string;
  readonly message: string;
}

export interface DeliveryReport {
  readonly delivered: number;
  readonly commandOutcomes: readonly CommandOutcome[];
  readonly faults: readonly ConsumerFault[];
}

export type PublishResult = { readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] };

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateEnvelope = ajv.compile(envelopeSchema);

const contractKey = (id: string, version: number): string => `${id}@${version}`;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export class MessageBus {
  private readonly contracts = new Map<string, MessageContract>();
  private readonly subscribers = new Map<string, Map<string, (message: AnyMessage) => void>>();
  private readonly commandHandlers = new Map<string, Map<string, (command: CommandMessage<unknown>) => CommandDecision>>();
  private readonly seenMessageIds = new Set<string>();
  private queue: AnyMessage[] = [];
  private tick = 0;
  private delivering = false;

  public get currentTick(): number {
    return this.tick;
  }

  /** Set by the simulation scheduler at the start of each tick. Ticks never go backwards. */
  public setTick(tick: number): void {
    if (!Number.isSafeInteger(tick) || tick < this.tick) throw new RangeError(`Tick ${tick} must be an integer >= current tick ${this.tick}.`);
    this.tick = tick;
  }

  public registerContract(contract: MessageContract): void {
    if (!Number.isSafeInteger(contract.contractVersion) || contract.contractVersion < 1) {
      throw new RangeError(`Contract version for "${contract.contractId}" must be an integer >= 1.`);
    }
    const key = contractKey(contract.contractId, contract.contractVersion);
    if (this.contracts.has(key)) throw new Error(`Contract ${key} is already registered.`);
    this.contracts.set(key, contract);
  }

  /** Subscribe to a non-command contract (all registered versions share the contract id). */
  public subscribe(contractId: string, consumerId: string, handler: (message: AnyMessage) => void): () => void {
    const kinds = this.kindsFor(contractId);
    if (kinds.length === 0) throw new Error(`Cannot subscribe to unregistered contract "${contractId}".`);
    if (kinds.includes("command")) throw new Error(`"${contractId}" is a command contract; register a command handler instead.`);
    const map = this.subscribers.get(contractId) ?? new Map<string, (message: AnyMessage) => void>();
    if (map.has(consumerId)) throw new Error(`"${consumerId}" is already subscribed to "${contractId}".`);
    map.set(consumerId, handler);
    this.subscribers.set(contractId, map);
    return () => { map.delete(consumerId); };
  }

  /** The owning module's handler for one command contract. Exactly one per (contract, target). */
  public handleCommands(contractId: string, targetModuleId: string, handler: (command: CommandMessage<unknown>) => CommandDecision): void {
    if (!this.kindsFor(contractId).includes("command")) throw new Error(`"${contractId}" is not a registered command contract.`);
    const map = this.commandHandlers.get(contractId) ?? new Map<string, (command: CommandMessage<unknown>) => CommandDecision>();
    if (map.has(targetModuleId)) throw new Error(`"${targetModuleId}" already handles "${contractId}".`);
    map.set(targetModuleId, handler);
    this.commandHandlers.set(contractId, map);
  }

  public publish(message: AnyMessage): PublishResult {
    const errors: string[] = [];
    if (!validateEnvelope(message)) {
      errors.push(...(validateEnvelope.errors ?? []).map((e) => `envelope ${e.instancePath || "/"} ${e.message ?? "invalid"}`));
      return { ok: false, errors };
    }
    const contract = this.contracts.get(contractKey(message.contractId, message.contractVersion));
    if (!contract) {
      const known = this.kindsFor(message.contractId).length > 0;
      errors.push(known
        ? `Unsupported version ${message.contractVersion} of contract "${message.contractId}".`
        : `Unknown contract "${message.contractId}".`);
    } else {
      if (contract.kind !== message.kind) {
        errors.push(`Contract "${message.contractId}" carries ${contract.kind} messages, not ${message.kind}.`);
      } else {
        for (const problem of contract.validatePayload?.(message.payload) ?? []) errors.push(`payload: ${problem}`);
      }
    }
    if (this.seenMessageIds.has(message.messageId)) errors.push(`Duplicate messageId "${message.messageId}".`);
    if (message.simulationTick !== this.tick) errors.push(`Message stamped tick ${message.simulationTick}, bus is at tick ${this.tick}.`);
    if (message.kind === "observation" && message.acquiredAtTick > message.simulationTick) {
      errors.push(`Observation acquired at tick ${message.acquiredAtTick} after publication tick ${message.simulationTick}.`);
    }
    if (errors.length > 0) return { ok: false, errors };

    this.seenMessageIds.add(message.messageId);
    if (message.kind === "snapshot") deepFreeze(message.payload);
    this.queue.push(Object.freeze({ ...message }) as AnyMessage);
    return { ok: true };
  }

  /** Deliver everything queued before this call, in publish order. */
  public deliver(): DeliveryReport {
    if (this.delivering) throw new Error("deliver() is not re-entrant.");
    this.delivering = true;
    const batch = this.queue;
    this.queue = [];
    const commandOutcomes: CommandOutcome[] = [];
    const faults: ConsumerFault[] = [];
    let delivered = 0;
    try {
      for (const message of batch) {
        if (message.kind === "command") {
          const outcome = this.dispatchCommand(message, faults);
          commandOutcomes.push(outcome);
          if (outcome.accepted) delivered++;
          continue;
        }
        const consumers = this.subscribers.get(message.contractId);
        if (!consumers) continue;
        for (const consumerId of [...consumers.keys()].sort()) {
          try {
            (consumers.get(consumerId) as (m: AnyMessage) => void)(message);
            delivered++;
          } catch (cause) {
            faults.push({ messageId: message.messageId, consumerId, message: cause instanceof Error ? cause.message : String(cause) });
          }
        }
      }
    } finally {
      this.delivering = false;
    }
    return { delivered, commandOutcomes, faults };
  }

  private dispatchCommand(command: CommandMessage<unknown>, faults: ConsumerFault[]): CommandOutcome {
    const base = {
      messageId: command.messageId, contractId: command.contractId, targetModuleId: command.targetModuleId, tick: this.tick,
      ...(command.correlationId === undefined ? {} : { correlationId: command.correlationId })
    };
    const handler = this.commandHandlers.get(command.contractId)?.get(command.targetModuleId);
    if (!handler) return { ...base, accepted: false, reason: `No handler for "${command.contractId}" on "${command.targetModuleId}".` };
    try {
      const decision = handler(command);
      return decision.accepted ? { ...base, accepted: true } : { ...base, accepted: false, reason: decision.reason };
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      faults.push({ messageId: command.messageId, consumerId: command.targetModuleId, message: text });
      return { ...base, accepted: false, reason: `Handler fault: ${text}` };
    }
  }

  private kindsFor(contractId: string): MessageKind[] {
    return [...this.contracts.values()].filter((c) => c.contractId === contractId).map((c) => c.kind);
  }
}
