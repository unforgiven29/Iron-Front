import { expect, test } from "@playwright/test";

test("application shell loads and identifies its implementation status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Simulation foundation" })).toBeVisible();
  await expect(page.getByText("it is not a flight simulator", { exact: false })).toBeVisible();
});

test("fixed-step clock self-check advances exactly two ticks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run clock check" }).click();
  await expect(page.locator("#tick-value")).toHaveText("2");
  await expect(page.locator("#check-result")).toContainText("exactly 2 fixed steps");
});

test("runtime monitor runs the live simulation and accepts commands", async ({ page }) => {
  await page.goto("/");
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
  await page.goto("/");
  const canvas = page.getByLabel("Flight view. Click, then use the keyboard to fly.");
  await canvas.click();
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Reset (R)" }).click();
  await expect(page.getByText("Fictional test airframe", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
