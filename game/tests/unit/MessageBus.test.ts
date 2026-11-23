import { describe, expect, it } from "vitest";
import type { CommandMessage, DomainEvent, ImmutableSnapshot, Observation } from "../../src/core/contracts/Messages.js";
import { MessageBus, type AnyMessage } from "../../src/core/events/MessageBus.js";

let counter = 0;
const common = (bus: MessageBus, contractId: string, contractVersion = 1) => ({
  messageId: `m-${++counter}`, contractId, contractVersion, producerModuleId: "test.producer",
  simulationTick: bus.currentTick, simulationTimeSeconds: bus.currentTick / 120, status: "valid" as const
});
const command = (bus: MessageBus, payload: unknown, target = "test.engine"): CommandMessage<unknown> =>
  ({ ...common(bus, "test.throttle-command"), kind: "command", issuerId: "test.pilot", targetModuleId: target, payload, correlationId: "c-1" });
const event = (bus: MessageBus, payload: unknown, version = 1): DomainEvent<unknown> =>
  ({ ...common(bus, "test.engine-state", version), kind: "event", eventType: "engine.state-changed", payload });

function makeBus(): MessageBus {
  const bus = new MessageBus();
  bus.registerContract({
    contractId: "test.throttle-command", contractVersion: 1, kind: "command",
    validatePayload: (p) => (typeof (p as { position?: unknown })?.position === "number" ? [] : ["position must be a number"])
  });
  bus.registerContract({ contractId: "test.engine-state", contractVersion: 1, kind: "event" });
  bus.registerContract({ contractId: "test.contact", contractVersion: 1, kind: "observation" });
  bus.registerContract({ contractId: "test.status", contractVersion: 1, kind: "snapshot" });
  return bus;
}

describe("MessageBus", () => {
  it("routes a command to its target owner, which accepts or rejects it", () => {
    const bus = makeBus();
    bus.handleCommands("test.throttle-command", "test.engine", (c) =>
      ((c.payload as { position: number }).position <= 1 ? { accepted: true } : { accepted: false, reason: "beyond throttle stop" }));
    const ok = command(bus, { position: 0.8 });
    const tooFar = command(bus, { position: 1.4 });
    const nobody = command(bus, { position: 0.5 }, "test.other");
    for (const m of [ok, tooFar, nobody]) expect(bus.publish(m)).toEqual({ ok: true });
    const report = bus.deliver();
    expect(report.commandOutcomes).toEqual([
      { messageId: ok.messageId, contractId: "test.throttle-command", targetModuleId: "test.engine", tick: 0, accepted: true, correlationId: "c-1" },
      { messageId: tooFar.messageId, contractId: "test.throttle-command", targetModuleId: "test.engine", tick: 0, accepted: false, reason: "beyond throttle stop", correlationId: "c-1" },
      expect.objectContaining({ messageId: nobody.messageId, accepted: false, reason: 'No handler for "test.throttle-command" on "test.other".' })
    ]);
  });

  it("rejects malformed envelopes, unknown contracts/versions, wrong kinds and invalid payloads", () => {
    const bus = makeBus();
    const missingIssuer: Record<string, unknown> = { ...command(bus, { position: 0 }) };
    delete missingIssuer.issuerId;
    expect(bus.publish(missingIssuer as unknown as AnyMessage).ok).toBe(false);
    expect(bus.publish({ ...event(bus, {}), contractId: "test.nope" })).toEqual({ ok: false, errors: ['Unknown contract "test.nope".'] });
    expect(bus.publish(event(bus, {}, 2))).toEqual({ ok: false, errors: ['Unsupported version 2 of contract "test.engine-state".'] });
    expect(bus.publish({ ...event(bus, {}), contractId: "test.throttle-command" })).toMatchObject({ ok: false, errors: ['Contract "test.throttle-command" carries command messages, not event.'] });
    expect(bus.publish(command(bus, { position: "full" }))).toEqual({ ok: false, errors: ["payload: position must be a number"] });
    expect(bus.deliver().delivered).toBe(0);
  });

  it("rejects duplicate message ids and messages stamped with another tick", () => {
    const bus = makeBus();
    const e = event(bus, {});
    expect(bus.publish(e).ok).toBe(true);
    expect(bus.publish(e)).toMatchObject({ ok: false, errors: [`Duplicate messageId "${e.messageId}".`] });
    bus.setTick(5);
    expect(bus.publish({ ...event(bus, {}), simulationTick: 4 })).toMatchObject({ ok: false, errors: ["Message stamped tick 4, bus is at tick 5."] });
    expect(() => bus.setTick(3)).toThrow(">= current tick 5");
  });

  it("delivers events in publish order to subscribers in id order, only to subscribed contracts", () => {
    const bus = makeBus();
    const log: string[] = [];
    bus.subscribe("test.engine-state", "zeta", (m) => log.push(`zeta:${(m.payload as { n: number }).n}`));
    bus.subscribe("test.engine-state", "alpha", (m) => log.push(`alpha:${(m.payload as { n: number }).n}`));
    bus.subscribe("test.status", "alpha", () => log.push("alpha:status"));
    bus.publish(event(bus, { n: 1 }));
    bus.publish(event(bus, { n: 2 }));
    bus.deliver();
    expect(log).toEqual(["alpha:1", "zeta:1", "alpha:2", "zeta:2"]);
  });

  it("holds messages published during delivery until the next delivery", () => {
    const bus = makeBus();
    const log: number[] = [];
    bus.subscribe("test.engine-state", "chain", (m) => {
      const n = (m.payload as { n: number }).n;
      log.push(n);
      if (n < 3) bus.publish(event(bus, { n: n + 1 }));
      expect(() => bus.deliver()).toThrow("not re-entrant");
    });
    bus.publish(event(bus, { n: 1 }));
    bus.deliver();
    expect(log).toEqual([1]);
    bus.deliver();
    bus.deliver();
    expect(log).toEqual([1, 2, 3]);
  });

  it("isolates consumer and handler faults", () => {
    const bus = makeBus();
    const log: string[] = [];
    bus.subscribe("test.engine-state", "a.bad", () => { throw new Error("consumer broke"); });
    bus.subscribe("test.engine-state", "b.good", () => log.push("good"));
    bus.handleCommands("test.throttle-command", "test.engine", () => { throw new Error("handler broke"); });
    const e = event(bus, {});
    const c = command(bus, { position: 0 });
    bus.publish(e);
    bus.publish(c);
    const report = bus.deliver();
    expect(log).toEqual(["good"]);
    expect(report.faults).toEqual([
      { messageId: e.messageId, consumerId: "a.bad", message: "consumer broke" },
      { messageId: c.messageId, consumerId: "test.engine", message: "handler broke" }
    ]);
    expect(report.commandOutcomes[0]).toMatchObject({ accepted: false, reason: "Handler fault: handler broke" });
  });

  it("keeps observation uncertainty and rejects acquisition after publication", () => {
    const bus = makeBus();
    bus.setTick(10);
    let received: AnyMessage | undefined;
    bus.subscribe("test.contact", "test.ai", (m) => { received = m; });
    const obs: Observation<{ bearingDeg: number }, { bearingSigmaDeg: number }> = {
      ...common(bus, "test.contact"), kind: "observation", sourceId: "test.rwr", acquiredAtTick: 9,
      payload: { value: { bearingDeg: 45 }, uncertainty: { bearingSigmaDeg: 5 } }
    };
    expect(bus.publish(obs).ok).toBe(true);
    expect(bus.publish({ ...obs, messageId: "late", acquiredAtTick: 11 })).toMatchObject({ ok: false });
    bus.deliver();
    expect(received?.payload).toEqual({ value: { bearingDeg: 45 }, uncertainty: { bearingSigmaDeg: 5 } });
  });

  it("deep-freezes snapshot payloads so consumers cannot mutate published state", () => {
    const bus = makeBus();
    const snapshot: ImmutableSnapshot<{ engine: { rpmPercent: number } }> = { ...common(bus, "test.status"), kind: "snapshot", payload: { engine: { rpmPercent: 92 } } };
    bus.subscribe("test.status", "test.ui", (m) => {
      expect(() => { (m.payload as { engine: { rpmPercent: number } }).engine.rpmPercent = 0; }).toThrow(TypeError);
    });
    bus.publish(snapshot);
    bus.deliver();
    expect(snapshot.payload.engine.rpmPercent).toBe(92);
  });

  it("validates registration", () => {
    const bus = makeBus();
    expect(() => bus.registerContract({ contractId: "test.engine-state", contractVersion: 1, kind: "event" })).toThrow("already registered");
    expect(() => bus.registerContract({ contractId: "x", contractVersion: 0, kind: "event" })).toThrow(">= 1");
    expect(() => bus.subscribe("test.nope", "a", () => undefined)).toThrow("unregistered");
    expect(() => bus.subscribe("test.throttle-command", "a", () => undefined)).toThrow("command handler");
    expect(() => bus.handleCommands("test.engine-state", "a", () => ({ accepted: true }))).toThrow("not a registered command");
    bus.handleCommands("test.throttle-command", "e", () => ({ accepted: true }));
    expect(() => bus.handleCommands("test.throttle-command", "e", () => ({ accepted: true }))).toThrow("already handles");
    const unsubscribe = bus.subscribe("test.engine-state", "a", () => { throw new Error("should not run"); });
    unsubscribe();
    bus.publish(event(bus, {}));
    expect(bus.deliver().faults).toEqual([]);
  });
});
