/**
 * Runtime monitor demo: wires the real Stage 1 services (module resolver/composer, scheduler,
 * message bus, entity registry) around a deliberately fictional "demo turbine" so the runtime can
 * be watched in a browser. The turbine is a first-order lag, not a propulsion model, and carries no
 * technical data. Presentation reads only the published snapshot and sends only commands.
 */
import { composeModules, type ComposedRuntime, type ModuleFactory } from "../core/modules/ModuleComposer.js";
import { resolveModules, type ResolutionResult } from "../core/modules/ModuleResolver.js";
import type { ModuleManifest } from "../core/modules/ModuleTypes.js";
import { deriveEntityId, EntityRegistry, type EntityRecord } from "../core/entities/EntityRegistry.js";
import { MessageBus, type CommandOutcome, type ConsumerFault } from "../core/events/MessageBus.js";
import { SimulationScheduler, type SchedulerAdvance } from "../core/simulation/SimulationScheduler.js";

export const DEMO_HOST_API = "0.1.0";
const SCENARIO = "demo-monitor";
const TURBINE_CAPABILITY = "demo.turbine-api";
const STATUS_CONTRACT = "demo.status";
const THROTTLE_CONTRACT = "demo.throttle";
const SPOOL_EVENT = "demo.spool-milestone";

export interface DemoTurbineState {
  readonly entityId: string;
  readonly throttle: number;
  /** Fictional normalized spool level 0..1. */
  readonly spool: number;
}

export interface DemoStatusSnapshot {
  readonly tick: number;
  readonly timeSeconds: number;
  readonly turbines: readonly DemoTurbineState[];
}

export interface DemoLogEntry {
  readonly tick: number;
  readonly kind: "command" | "event" | "fault" | "lifecycle";
  readonly text: string;
}

interface TurbineApi {
  readonly states: () => readonly DemoTurbineState[];
  readonly spawn: (key: string, tick: number) => string;
}

const base = {
  manifestSchemaVersion: 1, kind: "simulation-service", version: "0.1.0",
  apiCompatibility: { minimum: "0.1.0", maximumExclusive: "0.2.0" }, configuration: [],
  provenance: { notes: "Fictional demo module for the runtime monitor. No technical data." }
} as const;

export const DEMO_MANIFESTS: readonly ModuleManifest[] = [
  { ...base, id: "demo.turbine", name: "Demo turbine (fictional)", provides: [{ id: TURBINE_CAPABILITY, apiVersion: "0.1.0" }], dependencies: [] },
  {
    ...base, id: "demo.telemetry", name: "Demo telemetry publisher", provides: [{ id: "demo.telemetry-api", apiVersion: "0.1.0" }],
    dependencies: [{ capabilityId: TURBINE_CAPABILITY, versionRange: "^0.1.0", optional: false }]
  }
];

export interface RuntimeDemo {
  readonly resolution: ResolutionResult;
  readonly runtime: ComposedRuntime;
  readonly scheduler: SimulationScheduler;
  advanceFrame(frameDeltaSeconds: number): SchedulerAdvance;
  step(): void;
  setThrottle(entityId: string, value: number): void;
  spawnTurbine(): string;
  retireTurbine(entityId: string): void;
  entities(): readonly EntityRecord[];
  onSnapshot(listener: (snapshot: DemoStatusSnapshot) => void): void;
  log(): readonly DemoLogEntry[];
}

export function createRuntimeDemo(): RuntimeDemo {
  const scheduler = new SimulationScheduler({ stepSeconds: 1 / 120 });
  const bus = new MessageBus();
  const registry = new EntityRegistry();
  const entries: DemoLogEntry[] = [];
  const record = (kind: DemoLogEntry["kind"], text: string): void => {
    entries.push({ tick: scheduler.currentTick, kind, text });
    if (entries.length > 200) entries.shift();
  };
  let sequence = 0;
  const envelope = (contractId: string, producerModuleId: string) => ({
    messageId: `${producerModuleId}-${++sequence}`, contractId, contractVersion: 1, producerModuleId,
    simulationTick: bus.currentTick, simulationTimeSeconds: bus.currentTick * scheduler.stepSeconds, status: "valid" as const
  });

  bus.registerContract({
    contractId: THROTTLE_CONTRACT, contractVersion: 1, kind: "command",
    validatePayload: (p) => {
      const v = (p as { value?: unknown } | null)?.value;
      return typeof v === "number" && Number.isFinite(v) ? [] : ["value must be a finite number"];
    }
  });
  bus.registerContract({ contractId: STATUS_CONTRACT, contractVersion: 1, kind: "snapshot" });
  bus.registerContract({ contractId: SPOOL_EVENT, contractVersion: 1, kind: "event" });
  bus.subscribe(SPOOL_EVENT, "debug.log", (m) => record("event", `${m.entityId ?? "?"}: ${(m.payload as { text: string }).text}`));

  scheduler.register({ id: "core.message-bus", phase: "commands", run: (ctx) => {
    bus.setTick(ctx.tick);
    const report = bus.deliver();
    for (const o of report.commandOutcomes) logOutcome(o);
    for (const f of report.faults) logFault(f);
  } });
  const logOutcome = (o: CommandOutcome): void => record("command", `${o.contractId} → ${o.targetModuleId}: ${o.accepted ? "accepted" : `rejected (${o.reason ?? ""})`}`);
  const logFault = (f: ConsumerFault): void => record("fault", `${f.consumerId}: ${f.message}`);

  const factories = new Map<string, ModuleFactory>([
    ["demo.turbine", { create: () => {
      const turbines = new Map<string, { throttle: number; spool: number; milestone: number }>();
      const spawn = (key: string, tick: number): string => {
        const id = deriveEntityId(SCENARIO, "turbine", key);
        registry.create(id, "demo-turbine", tick);
        turbines.set(id, { throttle: 0, spool: 0, milestone: 0 });
        bus.handleCommands(THROTTLE_CONTRACT, id, (c) => {
          const t = turbines.get(id);
          if (!t) return { accepted: false, reason: "turbine retired" };
          const value = (c.payload as { value: number }).value;
          if (value < 0 || value > 1) return { accepted: false, reason: "throttle must be within 0..1" };
          t.throttle = value;
          return { accepted: true };
        });
        const taskId = `demo.turbine:${id}`;
        scheduler.register({ id: taskId, phase: "integration", run: (ctx) => {
          const t = turbines.get(id);
          if (!t) return;
          // Fictional first-order lag toward the commanded level (time constant 1.5 s).
          t.spool += (t.throttle - t.spool) * (ctx.stepSeconds / 1.5);
          const milestone = Math.floor(t.spool * 4 + 1e-9);
          if (milestone !== t.milestone) {
            t.milestone = milestone;
            bus.publish({ ...envelope(SPOOL_EVENT, "demo.turbine"), kind: "event", eventType: "spool-milestone", entityId: id, payload: { text: `spool crossed ${milestone * 25}%` } });
          }
        } });
        registry.addRetirementHook(id, "demo.turbine", () => {
          turbines.delete(id);
          scheduler.unregister(taskId);
        });
        registry.activate(id, tick);
        record("lifecycle", `${id} created and activated`);
        return id;
      };
      const api: TurbineApi = {
        states: () => [...turbines].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([entityId, t]) => ({ entityId, throttle: t.throttle, spool: t.spool })),
        spawn
      };
      return { capabilities: { [TURBINE_CAPABILITY]: api } };
    } }],
    ["demo.telemetry", { create: (ctx) => {
      const turbine = ctx.require<TurbineApi>(TURBINE_CAPABILITY);
      scheduler.register({ id: "demo.telemetry", phase: "publish", periodTicks: 6, run: (tick) => {
        const payload: DemoStatusSnapshot = { tick: tick.tick, timeSeconds: tick.timeSeconds, turbines: turbine.states() };
        bus.publish({ ...envelope(STATUS_CONTRACT, "demo.telemetry"), kind: "snapshot", payload });
      } });
      return { capabilities: { "demo.telemetry-api": {} }, dispose: () => scheduler.unregister("demo.telemetry") };
    } }]
  ]);

  const resolution = resolveModules({ manifests: DEMO_MANIFESTS, hostApiVersion: DEMO_HOST_API });
  const runtime = composeModules(resolution, factories);
  const turbineApi = runtime.capability<TurbineApi>("demo.turbine", TURBINE_CAPABILITY);
  let spawned = 0;
  let n = 0;
  const spawnTurbine = (): string => turbineApi.spawn(`t${++spawned}`, scheduler.currentTick);
  spawnTurbine();

  return {
    resolution,
    runtime,
    scheduler,
    advanceFrame: (dt) => {
      const advance = scheduler.advanceFrame(dt);
      for (const f of advance.faults) record("fault", `${f.source} @${f.phase}: ${f.message}`);
      return advance;
    },
    step: () => {
      for (const f of scheduler.step()) record("fault", `${f.source} @${f.phase}: ${f.message}`);
    },
    setThrottle: (entityId, value) => {
      const result = bus.publish({ ...envelope(THROTTLE_CONTRACT, "ui.debug"), kind: "command", issuerId: "ui.debug", targetModuleId: entityId, payload: { value } });
      if (!result.ok) record("fault", `throttle command refused: ${result.errors.join("; ")}`);
    },
    spawnTurbine,
    retireTurbine: (entityId) => {
      const result = registry.retire(entityId, "despawned", scheduler.currentTick);
      if (result.changed) record("lifecycle", `${entityId} retired (despawned)`);
      for (const f of result.faults) record("fault", `${f.hookKey}: ${f.message}`);
    },
    entities: () => registry.list(),
    onSnapshot: (listener) => {
      bus.subscribe(STATUS_CONTRACT, `ui.debug.${++n}`, (m) => listener(m.payload as DemoStatusSnapshot));
    },
    log: () => entries
  };
}
