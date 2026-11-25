import { expect, test } from "@playwright/test";

test("application shell loads and identifies its implementation status", async ({ page }) => {
  await page.goto("/#debug");
  await expect(page.getByRole("heading", { name: "Simulation foundation" })).toBeVisible();
  await expect(page.getByText("it is not a flight simulator", { exact: false })).toBeVisible();
});

test("fixed-step clock self-check advances exactly two ticks", async ({ page }) => {
  await page.goto("/#debug");
  await page.getByRole("button", { name: "Run clock check" }).click();
  await expect(page.locator("#tick-value")).toHaveText("2");
  await expect(page.locator("#check-result")).toContainText("exactly 2 fixed steps");
});

test("runtime monitor runs the live simulation and accepts commands", async ({ page }) => {
  await page.goto("/#debug");
  const monitor = page.getByRole("region", { name: "Runtime monitor" });
  await expect(monitor).toBeVisible();
  await expect.poll(async () => Number(await page.locator("#mon-tick").textContent())).toBeGreaterThan(30);
  await expect(monitor.getByText("demo.telemetry · ready", { exact: false })).toBeVisible();
  await page.getByLabel("Throttle for demo-monitor/turbine/t1").fill("100");
  await expect(monitor.getByText("accepted", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await page.locator("#mon-tick").textContent();
  await page.getByRole("button", { name: "Step 1 tick" }).click();
  await expect(page.locator("#mon-tick")).toHaveText(String(Number(paused) + 1));
  await page.getByRole("button", { name: "Spawn turbine" }).click();
  await expect(monitor.getByText("demo-monitor/turbine/t2 · active")).toBeVisible();
});

test("debug flight view flies with the keyboard and reports no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#debug");
  const canvas = page.getByLabel("Flight view. Click, then use the keyboard to fly.");
  await canvas.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Reset (R)" }).click();
  await expect(page.getByText("Fictional test airframe", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Walk the sortie setup: optionally pick an aircraft, mission and start mode, then launch. */
async function launch(page: import("@playwright/test").Page, opts: { aircraft?: string; mission?: RegExp; start?: "Air start" | "Runway" } = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: /Sortie setup/ }).click();
  if (opts.aircraft) await page.getByRole("radiogroup", { name: "Aircraft" }).getByRole("radio", { name: new RegExp(opts.aircraft) }).click();
  await page.getByRole("button", { name: "Next" }).click();
  if (opts.mission) await page.getByRole("radiogroup", { name: "Mission" }).getByRole("radio", { name: opts.mission }).click();
  if (opts.start) await page.getByRole("radiogroup", { name: "Start" }).getByRole("radio", { name: opts.start }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden({ timeout: 20_000 });
}

test("main menu walks the sortie steps and the loadout choice changes the station diagram", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await page.getByRole("button", { name: /Sortie setup/ }).click();
  await page.getByRole("button", { name: /Loadout/ }).click();
  await page.getByRole("radiogroup", { name: "Loadout" }).getByRole("radio", { name: /Beyond visual range/ }).click();
  await expect(page.locator(".loadout-summary")).toHaveText("6 × AIM-120");
  await page.getByRole("button", { name: /Briefing/ }).click();
  await expect(page.locator(".facts")).toContainText("Beyond visual range");
  await page.getByRole("button", { name: "← Main menu" }).click();
  await expect(page.getByRole("link", { name: "Developer tools →" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("main game starts the F-16, flies, pauses and resumes without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page, { mission: /Free flight/, start: "Runway" });
  const frame = page.getByLabel("F-16C Block 50 cockpit view. Click, then use the keyboard to fly.");
  await frame.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  await page.keyboard.press("b");
  await page.keyboard.press("c"); // external view
  await page.waitForTimeout(200);
  await page.keyboard.press("c");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();
  expect(errors).toEqual([]);
});

test("hostile mission runs, the player can fire, and abort returns to the main menu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page, { mission: /Viper pair/ });
  await page.locator(".session-surface").click();
  await page.keyboard.press("f");
  await page.keyboard.press("l"); // AIM-9X without a lock: fires on boresight
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Abort to main menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("data panel toggles with I and shows surfaces, engines and systems pages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page, { ...(process.env.PANEL_AIRCRAFT ? { aircraft: process.env.PANEL_AIRCRAFT } : {}), mission: /Range traffic/, start: "Air start" });
  const frame = page.locator(".session-surface");
  await frame.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(400);
  await page.keyboard.press("i");
  await expect(page.locator(".data-panel")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-1.png` });
  await page.keyboard.press("2");
  await expect(page.locator(".data-panel .efb-svg")).toBeVisible();
  await page.waitForTimeout(600);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-2.png` });
  await page.keyboard.up("d");
  for (const k of ["3", "4", "5"]) {
    await page.keyboard.press(k);
    await expect(page.locator(".data-panel .dp-body > *").first()).toBeVisible();
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-${k}.png` });
  }
  await page.keyboard.press("i");
  await expect(page.locator(".data-panel")).toBeHidden();
  expect(errors).toEqual([]);
});

test("MiG-29 cockpit with live instruments loads and flies without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page, { aircraft: "MiG-29", mission: /Free flight/, start: "Runway" });
  const frame = page.getByLabel(/cockpit view/);
  await frame.click();
  await page.keyboard.press("x"); // flap lever
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
