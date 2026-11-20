import { SimulationClock } from "./core/time/SimulationClock.js";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root element #app was not found.");

const clock = new SimulationClock();

const main = document.createElement("main");
main.className = "shell";
main.innerHTML = [
  '<header class="topbar">',
  '<div class="brand-mark" aria-hidden="true">IF</div>',
  '<div><p class="eyebrow">IRON-FRONT / ENGINEERING BUILD</p><h1>Simulation foundation</h1></div>',
  '<span class="status-pill"><span class="status-dot"></span>Foundation stage</span>',
  '</header>',
  '<section class="intro">',
  '<p class="eyebrow">PROJECT STATUS</p>',
  '<h2>Build the simulation before building the battlefield.</h2>',
  '<p class="intro-copy">This is the first executable application shell. It validates the build and fixed-step clock wiring; it is not a flight simulator or a campaign implementation.</p>',
  '</section>',
  '<section class="panel-grid" aria-label="Foundation status">',
  '<article class="panel"><p class="panel-label">SIMULATION CLOCK</p><p class="metric" id="tick-value">0</p><p class="panel-note">Authoritative ticks · 120 Hz target</p></article>',
  '<article class="panel"><p class="panel-label">RENDERER</p><p class="metric metric-text">Not selected</p><p class="panel-note">Renderer-neutral adapter is defined</p></article>',
  '<article class="panel"><p class="panel-label">MODULE LOADER</p><p class="metric metric-text">Not implemented</p><p class="panel-note">Manifest contracts are established</p></article>',
  '</section>',
  '<section class="panel self-check"><div><p class="panel-label">CORE SELF-CHECK</p><p class="self-check-text" id="check-result">Ready. Run a 1/60-second frame through the 120 Hz clock.</p></div><button id="run-check" type="button">Run clock check</button></section>',
  '<footer><span>IRON-FRONT · STAGE 0</span><span>No placeholder capability is reported as implemented.</span></footer>'
].join("");

root.append(main);

const tickValue = document.querySelector<HTMLElement>("#tick-value");
const checkResult = document.querySelector<HTMLElement>("#check-result");
const runButton = document.querySelector<HTMLButtonElement>("#run-check");
if (!tickValue || !checkResult || !runButton) {
  throw new Error("Application shell is missing a required element.");
}

runButton.addEventListener("click", () => {
  const result = clock.advanceFrame(1 / 60);
  tickValue.textContent = String(result.currentTick);
  checkResult.textContent = result.stepsExecuted === 2
    ? "PASS — 1/60 second produced exactly 2 fixed steps. Current tick: " + result.currentTick + "."
    : "CHECK — " + result.stepsExecuted + " steps executed; inspect the clock configuration.";
});
