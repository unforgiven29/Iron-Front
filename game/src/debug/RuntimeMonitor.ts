/**
 * Browser view of the runtime demo. Presentation only: it renders published snapshots and the
 * demo log, and sends throttle commands through the message bus. It never mutates simulation state.
 */
import { createRuntimeDemo, type DemoStatusSnapshot } from "./RuntimeDemo.js";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountRuntimeMonitor(parent: HTMLElement): void {
  const demo = createRuntimeDemo();

  const section = el("section", "panel monitor");
  section.setAttribute("aria-label", "Runtime monitor");
  section.innerHTML = [
    '<div class="monitor-head"><div><p class="panel-label">RUNTIME MONITOR · LIVE</p>',
    '<p class="panel-note">Real Stage 1 services driving a fictional demo turbine (a first-order lag, not an engine model).</p></div>',
    '<div class="monitor-controls"><button type="button" class="ghost" id="mon-pause">Pause</button>',
    '<button type="button" class="ghost" id="mon-step" disabled>Step 1 tick</button>',
    '<button type="button" class="ghost" id="mon-spawn">Spawn turbine</button></div></div>',
    '<div class="monitor-stats">',
    '<div><p class="panel-label">TICK</p><p class="metric" id="mon-tick">0</p></div>',
    '<div><p class="panel-label">SIM TIME</p><p class="metric" id="mon-time">0.00 s</p></div>',
    '<div><p class="panel-label">STEPS / FRAME</p><p class="metric" id="mon-steps">0</p></div>',
    '<div><p class="panel-label">STATE</p><p class="metric metric-text" id="mon-state">Running</p></div>',
    '</div>',
    '<div class="monitor-cols">',
    '<div><p class="panel-label">TURBINES (FROM SNAPSHOT)</p><div id="mon-turbines" class="turbines"></div></div>',
    '<div><p class="panel-label">MODULES (RESOLVED)</p><ul id="mon-modules" class="plain-list"></ul>',
    '<p class="panel-label spaced">ENTITIES</p><ul id="mon-entities" class="plain-list"></ul></div>',
    '</div>',
    '<p class="panel-label spaced">MESSAGE &amp; LIFECYCLE LOG</p><ol id="mon-log" class="log"></ol>'
  ].join("");
  parent.append(section);

  const q = <T extends HTMLElement>(id: string): T => {
    const node = section.querySelector<T>(`#${id}`);
    if (!node) throw new Error(`Runtime monitor element #${id} is missing.`);
    return node;
  };
  const tickEl = q("mon-tick"), timeEl = q("mon-time"), stepsEl = q("mon-steps"), stateEl = q("mon-state");
  const turbinesEl = q("mon-turbines"), modulesEl = q("mon-modules"), entitiesEl = q("mon-entities"), logEl = q("mon-log");
  const pauseBtn = q<HTMLButtonElement>("mon-pause"), stepBtn = q<HTMLButtonElement>("mon-step"), spawnBtn = q<HTMLButtonElement>("mon-spawn");

  for (const m of demo.resolution.modules) {
    const deps = m.bindings.map((b) => `${b.capabilityId} ← ${b.providerModuleId ?? "none"}`).join(", ");
    modulesEl.append(el("li", undefined, `${m.manifest.id} · ${m.status}${deps ? ` · ${deps}` : ""}`));
  }

  // Throttle sliders keyed by entity; rebuilt only when the turbine set changes.
  let renderedIds = "";
  const rows = new Map<string, { bar: HTMLElement; value: HTMLElement }>();
  const renderSnapshot = (snapshot: DemoStatusSnapshot): void => {
    const ids = snapshot.turbines.map((t) => t.entityId).join("|");
    if (ids !== renderedIds) {
      renderedIds = ids;
      rows.clear();
      turbinesEl.replaceChildren();
      if (snapshot.turbines.length === 0) turbinesEl.append(el("p", "panel-note", "No active turbines."));
      for (const t of snapshot.turbines) {
        const row = el("div", "turbine");
        const head = el("div", "turbine-head");
        head.append(el("code", undefined, t.entityId));
        const retire = el("button", "ghost small", "Retire");
        retire.type = "button";
        retire.addEventListener("click", () => demo.retireTurbine(t.entityId));
        head.append(retire);
        const slider = el("input");
        slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.value = String(Math.round(t.throttle * 100));
        slider.setAttribute("aria-label", `Throttle for ${t.entityId}`);
        slider.addEventListener("input", () => demo.setThrottle(t.entityId, Number(slider.value) / 100));
        const track = el("div", "spool-track");
        const bar = el("div", "spool-bar");
        track.append(bar);
        const value = el("p", "panel-note");
        row.append(head, slider, track, value);
        turbinesEl.append(row);
        rows.set(t.entityId, { bar, value });
      }
    }
    for (const t of snapshot.turbines) {
      const r = rows.get(t.entityId);
      if (!r) continue;
      r.bar.style.width = `${(t.spool * 100).toFixed(1)}%`;
      r.value.textContent = `throttle ${(t.throttle * 100).toFixed(0)}% · spool ${(t.spool * 100).toFixed(1)}% · snapshot tick ${snapshot.tick}`;
    }
  };
  demo.onSnapshot(renderSnapshot);

  let lastLogLength = -1;
  let lastLogTick = -1;
  const renderSide = (): void => {
    entitiesEl.replaceChildren(...demo.entities().map((e) =>
      el("li", undefined, `${e.id} · ${e.state}${e.retirementReason ? ` (${e.retirementReason})` : ""}`)));
    const log = demo.log();
    const newest = log[log.length - 1];
    if (log.length !== lastLogLength || (newest?.tick ?? -1) !== lastLogTick) {
      lastLogLength = log.length;
      lastLogTick = newest?.tick ?? -1;
      logEl.replaceChildren(...log.slice(-12).reverse().map((entry) => {
        const li = el("li", `log-${entry.kind}`);
        li.append(el("span", "log-tick", `#${entry.tick}`), el("span", undefined, `${entry.kind} · ${entry.text}`));
        return li;
      }));
    }
  };

  const renderClock = (steps: number, overloaded: boolean): void => {
    tickEl.textContent = String(demo.scheduler.currentTick);
    timeEl.textContent = `${(demo.scheduler.currentTick * demo.scheduler.stepSeconds).toFixed(2)} s`;
    stepsEl.textContent = String(steps);
    stateEl.textContent = demo.scheduler.isPaused ? "Paused" : overloaded ? "Overloaded" : "Running";
  };

  pauseBtn.addEventListener("click", () => {
    if (demo.scheduler.isPaused) demo.scheduler.resume(); else demo.scheduler.pause();
    pauseBtn.textContent = demo.scheduler.isPaused ? "Resume" : "Pause";
    stepBtn.disabled = !demo.scheduler.isPaused;
    renderClock(0, false);
  });
  stepBtn.addEventListener("click", () => {
    demo.step();
    renderClock(1, false);
    renderSide();
  });
  spawnBtn.addEventListener("click", () => {
    demo.spawnTurbine();
    renderSide();
  });

  // Frame time only requests advancement; the scheduler decides how many fixed ticks run.
  let last: number | null = null;
  const frame = (now: number): void => {
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    const advance = demo.advanceFrame(dt);
    renderClock(advance.stepsExecuted, advance.overloaded);
    renderSide();
    requestAnimationFrame(frame);
  };
  renderSide();
  requestAnimationFrame(frame);
}
