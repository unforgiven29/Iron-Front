/**
 * Main game screen (route "/"): hangar main menu, sortie setup (aircraft → mission → loadout →
 * briefing), pause menu and mission debrief. Developer tools live on a separate route (#debug).
 *
 * Presentation and flow only: the menu chooses an aircraft package, a scenario and a loadout id and
 * hands them to the session. Everything aircraft-specific (names, stores, controls) comes from the
 * aircraft definitions.
 */
import { loadAircraftCatalog } from "./AircraftCatalog.js";
import { el, startAircraftSession, type AircraftSessionHandle, type MissionResult, type StartMode } from "./AircraftSession.js";
import { SCENARIOS, type TargetScenario } from "./TestRange.js";
import { ThreeCockpitView } from "../rendering/three/ThreeCockpitView.js";
import { HangarPreview } from "../rendering/three/HangarPreview.js";
import type { AircraftDefinition } from "../platforms/aircraft/common/AircraftDefinition.js";

type Step = "aircraft" | "mission" | "loadout" | "briefing";
const STEPS: readonly { id: Step; label: string }[] = [
  { id: "aircraft", label: "Aircraft" }, { id: "mission", label: "Mission" }, { id: "loadout", label: "Loadout" }, { id: "briefing", label: "Briefing" }
];

const KEY_NAMES: Record<string, string> = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", enter: "Enter", backspace: "Backspace", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End", insert: "Ins", delete: "Del" };

function button(text: string, cls = "menu-btn"): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  return b;
}

function controlRows(definition: AircraftDefinition): (readonly [string, string])[] {
  const switchRows = definition.createSystems().switches.filter((s) => s.key).map((s) => [s.key!.toUpperCase(), s.definition.label] as const);
  const avionicsRows = (definition.createAvionics?.().controls ?? []).map((c) => [KEY_NAMES[c.key] ?? c.key.toUpperCase(), c.label] as const);
  return [
    ["W / S", "Pitch"], ["A / D", "Roll"], ["Q / E", "Yaw / nose-wheel steering"], ["Shift / Ctrl", "Throttle"], ["Space", "Wheel brakes"],
    ...switchRows, ...avionicsRows,
    ["C", "External / cockpit view"], ["I  (then 1 / 2 / 3)", "Data panel"], ["Right-drag / wheel", "Look around / zoom"], ["V", "Centre view"], ["R", "Restart"], ["Esc / P", "Pause"]
  ];
}

function controlsTable(definition: AircraftDefinition): HTMLElement {
  const box = el("div", "keys");
  for (const [k, v] of controlRows(definition)) {
    const row = el("div", "keys-row");
    row.append(el("kbd", undefined, k), el("span", undefined, v));
    box.append(row);
  }
  return box;
}

export function mountGameScreen(root: HTMLElement): void {
  document.body.classList.add("game-mode");
  const catalog = loadAircraftCatalog();
  if (catalog.ids.length === 0) throw new Error(`No aircraft could be loaded: ${catalog.problems.join("; ")}`);
  const defs = new Map(catalog.ids.map((id) => [id, catalog.definition(id)]));

  // Sortie selections.
  let aircraftId = catalog.ids[0]!;
  let scenario: TargetScenario = "hostile-1";
  let startMode: StartMode = "air";
  let hudLanguage = "ru";
  const loadoutByAircraft = new Map<string, string>();
  const def = () => defs.get(aircraftId)!;
  const loadoutId = () => loadoutByAircraft.get(aircraftId) ?? def().loadouts?.[0]?.id ?? "";

  const screen = el("main", "game-screen");
  // Each flight gets its own focusable surface inside this frame (fresh listeners per session).
  const frame = el("div", "game-frame");
  let surface: HTMLElement | null = null;
  const hangar = el("div", "hangar");
  const menu = el("div", "game-menu");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Game menu");
  screen.append(frame, hangar, menu);
  root.append(screen);

  let preview: HangarPreview | null = null;
  try { preview = new HangarPreview(hangar); preview.show(def().exteriorModelId); preview.start(); } catch { preview = null; /* no WebGL: plain backdrop */ }

  let session: AircraftSessionHandle | null = null;
  let view: "home" | Step | "controls" | "pause" | "debrief" = "home";
  let step: Step = "aircraft";
  let lastResult: MissionResult | null = null;
  let status = "";

  const setHangar = (visible: boolean) => {
    hangar.hidden = !visible;
    if (!preview) return;
    if (visible) preview.start(); else preview.stop();
  };

  // ---------- shared chrome ----------
  const brand = () => {
    const b = el("header", "brand");
    const mark = el("div", "brand-badge", "IF");
    const text = el("div");
    text.append(el("h1", "game-title", "IRON-FRONT"), el("p", "brand-tag", "Combat flight simulation"));
    b.append(mark, text);
    return b;
  };
  const panel = (title: string, sub?: string) => {
    const p = el("section", "menu-panel");
    const h = el("div", "panel-head");
    h.append(el("h2", "panel-title", title));
    if (sub) h.append(el("p", "panel-sub", sub));
    p.append(h);
    return p;
  };

  // ---------- home ----------
  const renderHome = () => {
    const wrap = el("div", "home");
    const nav = el("nav", "home-nav");
    nav.setAttribute("aria-label", "Main menu");
    const quick = button("Quick mission", "menu-btn primary big");
    quick.append(el("small", undefined, "Fight hostile F-16Cs"));
    const free = button("Free flight", "menu-btn big");
    free.append(el("small", undefined, "Runway or air start, empty sky"));
    const sortie = button("Sortie setup", "menu-btn big");
    sortie.append(el("small", undefined, "Choose aircraft, mission and loadout"));
    const controls = button("Controls", "menu-btn");
    const dev = el("a", "menu-link", "Developer tools →");
    dev.href = "#debug";
    quick.addEventListener("click", () => { scenario = "hostile-1"; startMode = "air"; step = "aircraft"; go("aircraft"); });
    free.addEventListener("click", () => { scenario = "none"; startMode = "runway"; step = "aircraft"; go("aircraft"); });
    sortie.addEventListener("click", () => { step = "aircraft"; go("aircraft"); });
    controls.addEventListener("click", () => go("controls"));
    nav.append(quick, free, sortie, controls, dev);
    const side = el("aside", "home-side");
    side.append(el("p", "eyebrow", "IN THE HANGAR"), el("h2", "home-aircraft", def().displayName), el("p", "home-note", def().dataNote));
    wrap.append(brand(), nav, side);
    return wrap;
  };

  // ---------- sortie stepper ----------
  const renderStepper = () => {
    const bar = el("ol", "stepper");
    STEPS.forEach((s, i) => {
      const li = el("li", `step${s.id === step ? " active" : ""}${STEPS.findIndex((x) => x.id === step) > i ? " done" : ""}`);
      const b = button(`${i + 1}  ${s.label}`, "step-btn");
      b.addEventListener("click", () => { step = s.id; go(s.id); });
      li.append(b);
      bar.append(li);
    });
    return bar;
  };

  const choiceCard = (title: string, body: string, selected: boolean, onPick: () => void, extra?: HTMLElement, group?: string) => {
    const c = el("button", `card${selected ? " selected" : ""}`);
    c.type = "button";
    c.setAttribute("role", "radio");
    c.setAttribute("aria-checked", String(selected));
    if (group) c.dataset["group"] = group;
    c.append(el("span", "card-title", title), el("span", "card-body", body));
    if (extra) c.append(extra);
    c.addEventListener("click", onPick);
    return c;
  };

  const renderAircraft = () => {
    const p = panel("Select aircraft", "Each aircraft runs its own flight model and systems.");
    const grid = el("div", "cards");
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", "Aircraft");
    for (const id of catalog.ids) {
      const d = defs.get(id)!;
      const tags = el("span", "card-tags");
      tags.append(el("span", "tag", `${d.engines.length} engine${d.engines.length > 1 ? "s" : ""}`), el("span", "tag", `${d.loadouts?.length ?? 0} loadouts`));
      grid.append(choiceCard(d.displayName, d.dataNote.length > 170 ? `${d.dataNote.slice(0, 167)}…` : d.dataNote, id === aircraftId, () => { aircraftId = id; preview?.show(d.exteriorModelId); go("aircraft"); }, tags));
    }
    p.append(grid);
    return p;
  };

  const renderMission = () => {
    const p = panel("Mission", "Hostile fighters are LOW FIDELITY placeholders with notional weapons.");
    const grid = el("div", "cards");
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", "Mission");
    for (const s of SCENARIOS) {
      const tag = el("span", "card-tags");
      tag.append(el("span", `tag${s.hostile ? " hot" : ""}`, s.hostile ? "Hostile" : "Training"));
      grid.append(choiceCard(s.label, s.description, s.id === scenario, () => { scenario = s.id; if (s.hostile) startMode = "air"; go("mission"); }, tag));
    }
    const opts = el("div", "options");
    const seg = (label: string, values: readonly (readonly [string, string])[], current: string, set: (v: string) => void) => {
      const g = el("div", "seg");
      g.setAttribute("role", "radiogroup");
      g.setAttribute("aria-label", label);
      g.append(el("span", "seg-label", label));
      for (const [v, t] of values) {
        const b = button(t, `seg-btn${v === current ? " on" : ""}`);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(v === current));
        b.addEventListener("click", () => { set(v); go("mission"); });
        g.append(b);
      }
      return g;
    };
    opts.append(
      seg("Start", [["air", "Air start"], ["runway", "Runway"]], startMode, (v) => { startMode = v as StartMode; }),
      seg("HUD language (where supported)", [["ru", "As on the aircraft"], ["en", "English"]], hudLanguage, (v) => { hudLanguage = v; })
    );
    p.append(grid, opts);
    return p;
  };

  const renderLoadout = () => {
    const d = def();
    const p = panel(`Loadout — ${d.displayName}`, d.loadouts?.length ? "Stations shown left wingtip to right wingtip." : undefined);
    const options = d.loadouts ?? [];
    if (options.length === 0) { p.append(el("p", "panel-sub", "This aircraft has no selectable stores.")); return p; }
    const current = options.find((l) => l.id === loadoutId()) ?? options[0]!;
    // Station diagram.
    const diagram = el("div", "pylons");
    diagram.setAttribute("aria-label", "Stations");
    current.stations.forEach((name, i) => {
      const st = el("div", `pylon${name ? "" : " empty"}`);
      st.append(el("span", "pylon-no", String(i + 1)), el("span", "pylon-store", name || "empty"));
      diagram.append(st);
    });
    const counts = new Map<string, number>();
    for (const n of current.stations) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    const summary = el("p", "loadout-summary", counts.size ? [...counts].map(([n, c]) => `${c} × ${n}`).join("  ·  ") : "No stores");
    const grid = el("div", "cards compact");
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", "Loadout");
    for (const l of options) grid.append(choiceCard(l.label, l.description, l.id === current.id, () => { loadoutByAircraft.set(aircraftId, l.id); go("loadout"); }));
    p.append(diagram, summary, grid);
    return p;
  };

  const renderBriefing = () => {
    const d = def();
    const s = SCENARIOS.find((x) => x.id === scenario)!;
    const lo = d.loadouts?.find((l) => l.id === loadoutId());
    const p = panel("Briefing", s.description);
    const facts = el("dl", "facts");
    for (const [k, v] of [["Aircraft", d.displayName], ["Mission", s.label], ["Start", startMode === "air" ? "Air start, 1,800 m above ground, heading north" : "Runway 36, engine at idle"], ["Loadout", lo?.label ?? "—"]] as const) {
      facts.append(el("dt", undefined, k), el("dd", undefined, v));
    }
    const tips = el("ul", "tips");
    for (const t of s.hostile
      ? ["Lock with the radar (cursor + Enter), then launch with L. F selects the missile.", "A MISSILE warning gives the clock position: turn to put it on your beam and dive.", "Press C for the external view, Esc to pause."]
      : ["Shift/Ctrl set throttle; W/S/A/D fly. Press C for the external view.", "Esc pauses the game."]) tips.append(el("li", undefined, t));
    p.append(facts, tips);
    return p;
  };

  const renderSortie = () => {
    const wrap = el("div", "sortie");
    const top = el("div", "sortie-top");
    const back = button("← Main menu", "menu-btn ghost");
    back.addEventListener("click", () => go("home"));
    top.append(brand(), back);
    const body = step === "aircraft" ? renderAircraft() : step === "mission" ? renderMission() : step === "loadout" ? renderLoadout() : renderBriefing();
    const foot = el("div", "sortie-foot");
    const idx = STEPS.findIndex((x) => x.id === step);
    const prev = button("Back", "menu-btn ghost");
    prev.disabled = idx === 0;
    prev.addEventListener("click", () => { step = STEPS[Math.max(0, idx - 1)]!.id; go(step); });
    const statusEl = el("p", "game-status", status);
    statusEl.setAttribute("role", "status");
    const next = idx < STEPS.length - 1 ? button("Next", "menu-btn primary") : button("Launch", "menu-btn primary launch");
    next.addEventListener("click", () => { if (idx < STEPS.length - 1) { step = STEPS[idx + 1]!.id; go(step); } else launch(next); });
    foot.append(prev, statusEl, next);
    wrap.append(top, renderStepper(), body, foot);
    return wrap;
  };

  const renderControls = () => {
    const wrap = el("div", "sortie");
    const top = el("div", "sortie-top");
    const back = button(session ? "← Back" : "← Main menu", "menu-btn ghost");
    back.addEventListener("click", () => go(session ? "pause" : "home"));
    top.append(brand(), back);
    const p = panel(`Controls — ${def().displayName}`);
    p.append(controlsTable(def()));
    wrap.append(top, p);
    return wrap;
  };

  // ---------- pause / debrief ----------
  const renderPause = () => {
    const card = el("div", "modal");
    card.append(el("p", "eyebrow", "PAUSED"), el("h2", "modal-title", def().displayName));
    const resume = button("Resume", "menu-btn primary");
    const restart = button("Restart", "menu-btn");
    const controls = button("Controls", "menu-btn");
    const quit = button("Abort to main menu", "menu-btn ghost");
    resume.addEventListener("click", () => { session?.setPaused(false); hide(); });
    restart.addEventListener("click", () => { session?.restart(); session?.setPaused(false); hide(); });
    controls.addEventListener("click", () => go("controls"));
    quit.addEventListener("click", () => endSession());
    card.append(resume, restart, controls, quit);
    queueMicrotask(() => resume.focus());
    return card;
  };

  const renderDebrief = () => {
    const r = lastResult;
    const card = el("div", "modal debrief");
    const title = !r ? "Mission over" : r.outcome === "victory" ? "Mission complete" : r.outcome === "shot-down" ? "Shot down" : "Aircraft lost";
    card.append(el("p", `eyebrow ${r?.outcome === "victory" ? "good" : "bad"}`, "DEBRIEF"), el("h2", "modal-title", title));
    if (r) {
      const facts = el("dl", "facts");
      const mm = Math.floor(r.timeS / 60), ss = Math.floor(r.timeS % 60);
      for (const [k, v] of [["Kills", `${r.kills} / ${r.hostiles}`], ["Missiles fired", String(r.shotsFired)], ["Mission time", `${mm}:${String(ss).padStart(2, "0")}`], ...(r.cause ? [["Lost to", r.cause] as const] : [])] as const) facts.append(el("dt", undefined, k), el("dd", undefined, v));
      card.append(facts);
    }
    const again = button("Fly again", "menu-btn primary");
    const quit = button("Main menu", "menu-btn ghost");
    again.addEventListener("click", () => { session?.restart(); session?.setPaused(false); hide(); });
    quit.addEventListener("click", () => endSession());
    card.append(again, quit);
    queueMicrotask(() => again.focus());
    return card;
  };

  // ---------- flow ----------
  const go = (v: typeof view) => {
    view = v;
    menu.hidden = false;
    menu.className = `game-menu ${session ? "overlay" : "full"}`;
    setHangar(!session);
    const content = v === "home" ? renderHome() : v === "controls" ? renderControls() : v === "pause" ? renderPause() : v === "debrief" ? renderDebrief() : renderSortie();
    menu.replaceChildren(content);
  };
  const hide = () => { menu.hidden = true; surface?.focus(); };

  const endSession = () => {
    session?.dispose();
    session = null;
    surface = null;
    frame.replaceChildren();
    go("home");
  };

  const launch = (btn: HTMLButtonElement) => {
    btn.disabled = true;
    status = "Loading…";
    const d = def();
    try {
      frame.replaceChildren();
      surface = el("div", "session-surface");
      surface.tabIndex = 0;
      surface.setAttribute("aria-label", `${d.displayName} cockpit view. Click, then use the keyboard to fly.`);
      frame.append(surface);
      const options: Record<string, string> = { hudLanguage };
      if (loadoutId()) options["loadout"] = loadoutId();
      session = startAircraftSession(ThreeCockpitView, surface, d, startMode, scenario, options, {
        onMissionEnd: (r) => { lastResult = r; session?.setPaused(true); go("debrief"); }
      });
      status = "";
      setHangar(false);
      hide();
    } catch (e) {
      status = `Could not start the 3D view: ${e instanceof Error ? e.message : String(e)}`;
      go(step);
    } finally {
      btn.disabled = false;
    }
  };

  window.addEventListener("keydown", (e) => {
    if (!session || (e.key !== "Escape" && e.key.toLowerCase() !== "p")) return;
    if (view === "debrief" && !menu.hidden) return;
    e.preventDefault();
    if (session.paused && !menu.hidden) { session.setPaused(false); hide(); }
    else { session.setPaused(true); go("pause"); }
  });

  go("home");
}
