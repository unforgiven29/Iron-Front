import { describe, expect, it } from "vitest";
import { createSave, InputJournal, loadSave, type PersistableModule, type SaveEnvelope } from "../../src/core/persistence/SaveState.js";
import { createScopedRandom, type SeededRandom } from "../../src/core/random/SeededRandom.js";
import { SimulationScheduler } from "../../src/core/simulation/SimulationScheduler.js";

const SCENARIO = "test-replay";
const SEED = 20261123;
const STEP = 1 / 120;
type Input = { readonly throttle: number };

/** Test-only simulation: a body driven by journaled throttle inputs plus seeded turbulence. */
class TestWorld {
  readonly scheduler = new SimulationScheduler({ stepSeconds: STEP, maxStepsPerFrame: 10_000, maxFrameDeltaSeconds: 1000 });
  readonly body = { position: 0, velocity: 0, throttle: 0 };
  readonly turbulence: SeededRandom = createScopedRandom(SEED, SCENARIO, "body-1", "turbulence");

  constructor(journal: InputJournal<Input>) {
    this.scheduler.register({ id: "inputs", phase: "commands", run: (ctx) => {
      for (const input of journal.inputsAt(ctx.tick)) this.body.throttle = input.throttle;
    } });
    this.scheduler.register({ id: "integrate", phase: "integration", run: (ctx) => {
      const gust = this.turbulence.nextRange(-0.5, 0.5);
      const accel = this.body.throttle * 20 - this.body.velocity * 0.1 + gust;
      this.body.velocity += accel * ctx.stepSeconds;
      this.body.position += this.body.velocity * ctx.stepSeconds;
    } });
  }

  readonly modules: PersistableModule[] = [
    {
      moduleId: "test.body", stateVersion: 1,
      save: () => ({ ...this.body }),
      validate: (s) => {
        const v = s as Partial<typeof this.body>;
        return ["position", "velocity", "throttle"].every((k) => Number.isFinite((v as Record<string, unknown>)[k])) ? [] : ["position/velocity/throttle must be finite numbers"];
      },
      load: (s) => Object.assign(this.body, s as typeof this.body)
    },
    {
      moduleId: "test.random", stateVersion: 1,
      save: () => ({ turbulence: this.turbulence.snapshot() }),
      validate: (s) => (Number.isInteger((s as { turbulence?: unknown }).turbulence) ? [] : ["turbulence stream state missing"]),
      load: (s) => this.turbulence.restore((s as { turbulence: number }).turbulence)
    }
  ];

  save(): SaveEnvelope {
    return createSave({ scenarioId: SCENARIO, seed: SEED, tick: this.scheduler.currentTick, stepSeconds: STEP }, this.modules);
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.scheduler.step();
  }
}

function recordedJournal(): InputJournal<Input> {
  const pilot = createScopedRandom(SEED, SCENARIO, "test-pilot");
  const journal = new InputJournal<Input>();
  for (let tick = 1; tick <= 600; tick += 37) journal.record(tick, { throttle: Math.round(pilot.nextFloat() * 100) / 100 });
  return journal;
}

describe("save, load and deterministic replay", () => {
  it("replaying the journal from the initial state reproduces the exact final state", () => {
    const journal = recordedJournal();
    const original = new TestWorld(journal);
    original.run(600);
    const replayed = new TestWorld(InputJournal.fromJSON<Input>(JSON.parse(JSON.stringify(journal.toJSON()))));
    replayed.run(600);
    expect(replayed.body).toEqual(original.body);
    expect(replayed.turbulence.snapshot()).toBe(original.turbulence.snapshot());
  });

  it("save at tick 300, load into a fresh runtime, continue: identical to an uninterrupted run", () => {
    const journal = recordedJournal();
    const uninterrupted = new TestWorld(journal);
    uninterrupted.run(600);

    const first = new TestWorld(journal);
    first.run(300);
    const saveText = JSON.stringify(first.save());

    const resumed = new TestWorld(journal);
    const outcome = loadSave(JSON.parse(saveText), { scenarioId: SCENARIO, stepSeconds: STEP }, resumed.modules);
    expect(outcome).toEqual({ ok: true, tick: 300 });
    if (outcome.ok) resumed.scheduler.restoreTick(outcome.tick);
    resumed.run(300);
    expect(resumed.scheduler.currentTick).toBe(600);
    expect(resumed.body).toEqual(uninterrupted.body);
  });

  it("refuses corrupt, mismatched or incomplete saves without touching live state", () => {
    const world = new TestWorld(recordedJournal());
    world.run(50);
    const good = world.save();
    const target = new TestWorld(recordedJournal());
    const untouched = { ...target.body };
    const expected = { scenarioId: SCENARIO, stepSeconds: STEP };
    const cases: [unknown, string][] = [
      [null, "not an object"],
      [{ ...good, formatVersion: 99 }, "Unsupported save format version 99"],
      [{ ...good, scenarioId: "other" }, 'scenario "other"'],
      [{ ...good, stepSeconds: 1 / 60 }, "runtime uses"],
      [{ ...good, modules: good.modules.filter((m) => m.moduleId !== "test.random") }, 'missing state for module "test.random"'],
      [{ ...good, modules: [...good.modules, { moduleId: "test.ghost", stateVersion: 1, state: {} }] }, 'unknown module "test.ghost"'],
      [{ ...good, modules: good.modules.map((m) => (m.moduleId === "test.body" ? { ...m, stateVersion: 2 } : m)) }, "migration is required"],
      [{ ...good, modules: good.modules.map((m) => (m.moduleId === "test.body" ? { ...m, state: { position: "x" } } : m)) }, "must be finite numbers"]
    ];
    for (const [save, fragment] of cases) {
      const outcome = loadSave(save, expected, target.modules);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.errors.join("\n")).toContain(fragment);
      expect(target.body).toEqual(untouched);
    }
  });

  it("rolls every module back when a load throws midway", () => {
    const world = new TestWorld(recordedJournal());
    world.run(10);
    const save = world.save();
    const target = new TestWorld(recordedJournal());
    target.run(3);
    const bodyBefore = { ...target.body };
    const rngBefore = target.turbulence.snapshot();
    // Fails on the incoming state only; restoring its own previous state succeeds.
    const exploding: PersistableModule = { moduleId: "test.zzz", stateVersion: 1, save: () => ({ mine: true }), validate: () => [],
      load: (s) => { if (!(s as { mine?: boolean }).mine) throw new Error("disk on fire"); } };
    const withExtra = { ...save, modules: [...save.modules, { moduleId: "test.zzz", stateVersion: 1, state: {} }] };
    const outcome = loadSave(withExtra, { scenarioId: SCENARIO, stepSeconds: STEP }, [...target.modules, exploding]);
    expect(outcome).toMatchObject({ ok: false, rolledBack: true });
    expect(target.body).toEqual(bodyBefore);
    expect(target.turbulence.snapshot()).toBe(rngBefore);

    const neverRestores: PersistableModule = { ...exploding, load: () => { throw new Error("always fails"); } };
    const broken = loadSave(withExtra, { scenarioId: SCENARIO, stepSeconds: STEP }, [...target.modules, neverRestores]);
    expect(broken).toMatchObject({ ok: false, rolledBack: false });
    if (!broken.ok) expect(broken.errors.join("\n")).toContain("runtime state is inconsistent");
  });

  it("journal rejects backwards ticks and non-serializable inputs; scheduler refuses restore with pending work", () => {
    const j = new InputJournal<unknown>();
    j.record(5, { a: 1 });
    expect(() => j.record(4, {})).toThrow("earlier than");
    expect(() => j.record(6, undefined)).toThrow("JSON-serializable");
    const s = new SimulationScheduler();
    s.scheduleAt({ tick: 3, phase: "commands", label: "x", run: () => undefined });
    expect(() => s.restoreTick(10)).toThrow("not serializable");
  });
});
