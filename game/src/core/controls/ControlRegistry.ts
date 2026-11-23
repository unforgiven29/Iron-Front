/**
 * Cockpit/vehicle control registry: discrete switches defined as data, owned by a system.
 *
 * Owner: game/core (controls). Presentation (cockpit meshes, keyboard bindings, UI) only
 * *requests* a position; the owning system's handler accepts or rejects it, and only an
 * accepted request changes state. Every change is recorded. This keeps cockpit layout and
 * input mapping per-aircraft, while systems never depend on how a switch is drawn or bound.
 */

export interface SwitchDefinition {
  /** Stable id, e.g. "f16.flcs.mode". */
  readonly id: string;
  /** Owning system (module/system id) that decides whether a change is accepted. */
  readonly ownerId: string;
  readonly label: string;
  /** Ordered positions, e.g. ["NORM", "DIRECT"]. */
  readonly positions: readonly string[];
  readonly defaultPosition: string;
  /** Provenance of the control itself, e.g. "real F-16 control" or "simulation test switch". */
  readonly provenance: string;
}

export type SwitchHandler = (request: { readonly switchId: string; readonly from: string; readonly to: string }) =>
  { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

export interface SwitchChange {
  readonly switchId: string;
  readonly from: string;
  readonly to: string;
  readonly accepted: boolean;
  readonly reason?: string;
  readonly source: string;
}

export class ControlRegistry {
  private readonly defs = new Map<string, SwitchDefinition>();
  private readonly positions = new Map<string, string>();
  private readonly handlers = new Map<string, SwitchHandler>();
  private readonly history: SwitchChange[] = [];

  /** Define a switch and attach its owner's handler. */
  public defineSwitch(def: SwitchDefinition, handler: SwitchHandler): void {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(def.id)) throw new RangeError(`Switch id "${def.id}" is not a stable lowercase id.`);
    if (this.defs.has(def.id)) throw new Error(`Switch "${def.id}" is already defined.`);
    if (def.positions.length < 2 || new Set(def.positions).size !== def.positions.length) throw new RangeError(`Switch "${def.id}" needs at least two distinct positions.`);
    if (!def.positions.includes(def.defaultPosition)) throw new RangeError(`Default position "${def.defaultPosition}" is not a position of "${def.id}".`);
    this.defs.set(def.id, def);
    this.positions.set(def.id, def.defaultPosition);
    this.handlers.set(def.id, handler);
  }

  public definitions(): readonly SwitchDefinition[] {
    return [...this.defs.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  public position(switchId: string): string {
    const p = this.positions.get(switchId);
    if (p === undefined) throw new Error(`Unknown switch "${switchId}".`);
    return p;
  }

  /** Request a position; the owner decides. Returns the recorded change. */
  public request(switchId: string, to: string, source: string): SwitchChange {
    const def = this.defs.get(switchId);
    if (!def) throw new Error(`Unknown switch "${switchId}".`);
    const from = this.position(switchId);
    let change: SwitchChange;
    if (!def.positions.includes(to)) {
      change = { switchId, from, to, accepted: false, reason: `"${to}" is not a position of ${def.label}`, source };
    } else if (to === from) {
      change = { switchId, from, to, accepted: true, source };
    } else {
      let decision: ReturnType<SwitchHandler>;
      try {
        decision = (this.handlers.get(switchId) as SwitchHandler)({ switchId, from, to });
      } catch (cause) {
        decision = { accepted: false, reason: `owner fault: ${cause instanceof Error ? cause.message : String(cause)}` };
      }
      if (decision.accepted) this.positions.set(switchId, to);
      change = decision.accepted ? { switchId, from, to, accepted: true, source } : { switchId, from, to, accepted: false, reason: decision.reason, source };
    }
    this.history.push(change);
    if (this.history.length > 200) this.history.shift();
    return change;
  }

  /** Step to the next position (wrapping), as a cockpit click or key binding would. */
  public cycle(switchId: string, source: string): SwitchChange {
    const def = this.defs.get(switchId);
    if (!def) throw new Error(`Unknown switch "${switchId}".`);
    const i = def.positions.indexOf(this.position(switchId));
    return this.request(switchId, def.positions[(i + 1) % def.positions.length] as string, source);
  }

  public changes(): readonly SwitchChange[] {
    return [...this.history];
  }

  /** Immutable map of current positions. */
  public snapshot(): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries([...this.positions].sort()));
  }
}
