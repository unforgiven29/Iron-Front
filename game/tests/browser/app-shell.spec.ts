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

test("main game starts the F-16, flies, pauses and resumes without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Fly" }).click();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden({ timeout: 20_000 });
  const frame = page.getByLabel("F-16 cockpit view. Click, then use the keyboard to fly.");
  await frame.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  await page.keyboard.press("f");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Developer tools →" })).toBeHidden();
  expect(errors).toEqual([]);
});

test("data panel toggles with I and shows surfaces, engines and systems pages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  if (process.env.PANEL_AIRCRAFT) await page.getByRole("combobox", { name: "Aircraft" }).selectOption({ label: process.env.PANEL_AIRCRAFT });
  await page.getByRole("button", { name: "Air start" }).click();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden({ timeout: 20_000 });
  const frame = page.locator(".game-frame");
  await frame.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(400);
  await page.keyboard.press("i");
  await expect(page.locator(".data-panel")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-1.png` });
  await page.keyboard.up("d");
  await page.keyboard.press("2");
  await expect(page.locator(".data-panel .efb-svg")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-2.png` });
  for (const k of ["3", "4", "5"]) {
    await page.keyboard.press(k);
    await expect(page.locator(".data-panel .dp-body > *").first()).toBeVisible();
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/panel-${k}.png` });
  }
  await page.keyboard.press("i");
  await expect(page.locator(".data-panel")).toBeHidden();
  expect(errors).toEqual([]);
});
