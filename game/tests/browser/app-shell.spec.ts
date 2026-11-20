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
