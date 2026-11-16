import { test, expect } from "@playwright/test";

// Fresh storage: no saved language, so the app must start in English.
test.use({ storageState: { cookies: [], origins: [] } });

test("English is the default and the toggle switches the whole deck", async ({
  page,
}) => {
  await page.goto("/#dashboard");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: /Fire, in another gravity/ }),
  ).toBeAttached();

  await page.getByRole("button", { name: "Español" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: /El fuego, en otra gravedad/ }),
  ).toBeAttached();

  // The choice is remembered across visits.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
