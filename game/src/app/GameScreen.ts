/**
 * Main game screen (route "/"): full-viewport F-16C Block 50 with a start/pause menu.
 * Developer tools live on a separate route (#debug).
 */
import { el, startF16Session, type F16SessionHandle } from "./F16Session.js";

export function mountGameScreen(root: HTMLElement): void {
  document.body.classList.add("game-mode");
  const screen = el("main", "game-screen");
  const frame = el("div", "game-frame");
  frame.tabIndex = 0;
  frame.setAttribute("aria-label", "F-16 cockpit view. Click, then use the keyboard to fly.");

  const menu = el("div", "game-menu");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Game menu");
  const card = el("div", "game-menu-card");
  const title = el("h1", "game-title", "IRON-FRONT");
  const subtitle = el("p", "game-subtitle", "F-16C Block 50");
  const status = el("p", "game-status", "");
  const fly = el("button", "game-button primary", "Fly");
  fly.type = "button";
  const restart = el("button", "game-button", "Restart");
  restart.type = "button";
  restart.hidden = true;
  const controls = el("div", "game-controls");
  for (const [k, v] of [
    ["W / S", "Pitch"], ["A / D", "Roll"], ["Q / E", "Yaw"], ["Shift / Ctrl", "Throttle"],
    ["F", "Fly-by-wire NORM / DIRECT (test)"], ["C", "CG test setting"], ["Right-drag / wheel", "Look around / zoom"], ["V", "Centre view"], ["R", "Reset"], ["Esc / P", "Pause"]
  ] as const) {
    const row = el("div", "game-control-row");
    row.append(el("kbd", undefined, k), el("span", undefined, v));
    controls.append(row);
  }
  const note = el("p", "game-note",
    "Provisional flight model: NASA TP-1538 low-speed F-16 wind-tunnel data (not Block 50-specific, no data above Mach 0.6), estimated engine, project-designed fly-by-wire.");
  const debug = el("a", "game-link", "Developer tools →");
  debug.href = "#debug";
  card.append(title, subtitle, status, fly, restart, controls, note, debug);
  menu.append(card);
  screen.append(frame, menu);
  root.append(screen);

  let session: F16SessionHandle | null = null;
  const showMenu = (paused: boolean) => {
    menu.hidden = false;
    fly.textContent = paused ? "Resume" : "Fly";
    restart.hidden = !paused;
    status.textContent = paused ? "Paused" : "";
    fly.focus();
  };
  const hideMenu = () => { menu.hidden = true; frame.focus(); };

  fly.addEventListener("click", async () => {
    if (session) {
      session.setPaused(false);
      hideMenu();
      return;
    }
    fly.disabled = true;
    status.textContent = "Loading…";
    try {
      const { ThreeCockpitView } = await import("../rendering/three/ThreeCockpitView.js");
      session = startF16Session(ThreeCockpitView, frame);
      status.textContent = "";
      hideMenu();
    } catch (e) {
      status.textContent = `Could not start the 3D view: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      fly.disabled = false;
    }
  });
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
