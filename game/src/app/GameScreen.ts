/**
 * Main game screen (route "/"): full-viewport F-16C Block 50 with a start/pause menu.
 * Developer tools live on a separate route (#debug).
 */
import { loadAircraftCatalog } from "./AircraftCatalog.js";
import { el, startAircraftSession, type AircraftSessionHandle } from "./AircraftSession.js";
import type { TargetScenario } from "./TestRange.js";

export function mountGameScreen(root: HTMLElement): void {
  document.body.classList.add("game-mode");
  const catalog = loadAircraftCatalog();
  const firstId = catalog.ids[0];
  if (!firstId) throw new Error(`No aircraft could be loaded: ${catalog.problems.join("; ")}`);
  let definition = catalog.definition(firstId);
  const screen = el("main", "game-screen");
  const frame = el("div", "game-frame");
  frame.tabIndex = 0;
  frame.setAttribute("aria-label", "F-16 cockpit view. Click, then use the keyboard to fly.");

  const menu = el("div", "game-menu");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Game menu");
  const card = el("div", "game-menu-card");
  const title = el("h1", "game-title", "IRON-FRONT");
  const subtitle = el("p", "game-subtitle", definition.displayName);
  // Aircraft selection: every package the module system loaded.
  const picker = el("select", "game-select");
  picker.setAttribute("aria-label", "Aircraft");
  for (const id of catalog.ids) {
    const opt = el("option", undefined, catalog.definition(id).displayName);
    opt.value = id;
    picker.append(opt);
  }
  // Air targets for sensor testing.
  const targetPicker = el("select", "game-select");
  targetPicker.setAttribute("aria-label", "Targets");
  for (const [v, label] of [["range", "Targets: range traffic"], ["dummies", "Targets: dummy test set"], ["none", "Targets: none"]] as const) {
    const opt = el("option", undefined, label);
    opt.value = v;
    targetPicker.append(opt);
  }
  const langPicker = el("select", "game-select");
  langPicker.setAttribute("aria-label", "HUD language");
  for (const [v, label] of [["ru", "HUD: Russian (as on the aircraft)"], ["en", "HUD: English"]] as const) {
    const opt = el("option", undefined, label);
    opt.value = v;
    langPicker.append(opt);
  }
  const status = el("p", "game-status", "");
  const fly = el("button", "game-button primary", "Fly");
  fly.type = "button";
  fly.title = "Start lined up on the runway, engine at idle";
  const airStart = el("button", "game-button", "Air start");
  airStart.type = "button";
  const restart = el("button", "game-button", "Restart");
  restart.type = "button";
  restart.hidden = true;
  const controls = el("div", "game-controls");
  const note = el("p", "game-note", definition.dataNote);
  // Controls: common flight keys plus the selected aircraft's own switch keys (from its package).
  const renderControls = () => {
    controls.replaceChildren();
    const switchRows = definition.createSystems().switches.filter((s) => s.key).map((s) => [s.key!.toUpperCase(), s.definition.label] as const);
    const KEY_NAMES: Record<string, string> = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", enter: "Enter", backspace: "Backspace", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End", insert: "Ins", delete: "Del" };
    const avionicsRows = (definition.createAvionics?.().controls ?? []).map((c) => [KEY_NAMES[c.key] ?? c.key.toUpperCase(), c.label] as const);
    for (const [k, v] of [
      ["W / S", "Pitch"], ["A / D", "Roll"], ["Q / E", "Yaw / nose-wheel steering"], ["Shift / Ctrl", "Throttle"], ["Space", "Wheel brakes"],
      ...switchRows,
      ...avionicsRows,
      ["I  (then 1 / 2 / 3)", "Data panel: surfaces / engines / systems"], ["Right-drag / wheel", "Look around / zoom"], ["V", "Centre view"], ["R", "Reset"], ["Esc / P", "Pause"]
    ] as const) {
      const row = el("div", "game-control-row");
      row.append(el("kbd", undefined, k), el("span", undefined, v));
      controls.append(row);
    }
    subtitle.textContent = definition.displayName;
    note.textContent = definition.dataNote;
  };
  renderControls();
  picker.addEventListener("change", () => { definition = catalog.definition(picker.value); renderControls(); });
  const debug = el("a", "game-link", "Developer tools →");
  debug.href = "#debug";
  card.append(title, subtitle, picker, targetPicker, langPicker, status, fly, airStart, restart, controls, note, debug);
  menu.append(card);
  screen.append(frame, menu);
  root.append(screen);

  let session: AircraftSessionHandle | null = null;
  const showMenu = (paused: boolean) => {
    menu.hidden = false;
    fly.textContent = paused ? "Resume" : "Fly";
    airStart.hidden = paused;
    picker.hidden = paused;
    targetPicker.hidden = paused;
    langPicker.hidden = paused;
    restart.hidden = !paused;
    status.textContent = paused ? "Paused" : "";
    fly.focus();
  };
  const hideMenu = () => { menu.hidden = true; frame.focus(); };

  const start = async (mode: "runway" | "air") => {
    if (session) {
      session.setPaused(false);
      hideMenu();
      return;
    }
    fly.disabled = true;
    status.textContent = "Loading…";
    try {
      const { ThreeCockpitView } = await import("../rendering/three/ThreeCockpitView.js");
      session = startAircraftSession(ThreeCockpitView, frame, definition, mode, targetPicker.value as TargetScenario, { hudLanguage: langPicker.value });
      status.textContent = "";
      hideMenu();
    } catch (e) {
      status.textContent = `Could not start the 3D view: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      fly.disabled = false;
    }
  };
  fly.addEventListener("click", () => { void start("runway"); });
  airStart.addEventListener("click", () => { void start("air"); });
  restart.addEventListener("click", () => {
    session?.restart();
    session?.setPaused(false);
    hideMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (!session || (e.key !== "Escape" && e.key.toLowerCase() !== "p")) return;
    e.preventDefault();
    if (session.paused) { session.setPaused(false); hideMenu(); }
    else { session.setPaused(true); showMenu(true); }
  });
  showMenu(false);
}
