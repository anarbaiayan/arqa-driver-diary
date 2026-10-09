import { test, expect } from "@playwright/test";
test("daily summary, date navigation, empty state and modal cancellation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("₸ 3,315", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.screenshot({ path: "screenshots/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(page.getByText("A fresh start")).toBeVisible();
  await page.getByRole("button", { name: "Add a trip", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("server error can retry successfully", async ({ page }) => {
  await page.route("**/api/trips?*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"error":"Test outage"}',
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Test outage");
  await page.unroute("**/api/trips?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("trip form validates reversed times and saves a valid trip", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Shift date", { exact: true }).fill("2026-10-03");
  await page
    .getByRole("button", { name: "Add trip", exact: false })
    .first()
    .click();
  await page.getByLabel("Fare (₸)").fill("1000");
  await page.getByLabel("Commission (₸)").fill("150");
  await page.getByLabel("End time").fill("2026-10-03T09:00");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByRole("alert")).toContainText("end must be later");
  await page.getByLabel("End time").fill("2026-10-03T10:20");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Trip saved.", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("₸ 850", { exact: true }).first()).toBeVisible();
});
