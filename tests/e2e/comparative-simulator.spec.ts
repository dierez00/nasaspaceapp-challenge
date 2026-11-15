import { expect, test, type Page } from "@playwright/test";

async function seek(page: Page, value: number) {
  await page
    .getByRole("slider", { name: "Progreso de simulación" })
    .evaluate((element, value) => {
      const input = element as HTMLInputElement;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

for (const width of [1440, 390]) {
  test(`three gravities share conditions and explain evidence at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#dashboard");
    await page
      .getByRole("button", { name: "Tres gravedades", exact: true })
      .click();
    await expect(page.locator(".scene-view")).toHaveCount(3);
    for (const slot of ["A", "B", "C"]) {
      await expect(page.getByTestId(`scene-${slot}`)).toBeVisible();
      await expect(page.getByTestId(`scene-${slot}`)).toContainText(
        "Escenario hipotético",
      );
    }
    await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
    await page.getByLabel("Oxígeno numérica A", { exact: true }).fill("45");
    await expect(page.locator(".shared-conditions")).toContainText("45.0 % O₂");
    for (const slot of ["A", "B", "C"])
      await expect(page.getByTestId(`scene-${slot}`)).toContainText("45.0");
    await seek(page, 4);
    await expect(page.getByTestId("physics-note")).toContainText("difusión");
    await page.locator(".laboratory").evaluate((element) => {
      element.scrollTop = 0;
      document.querySelector(".deck")!.scrollTop = 0;
    });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `test-results/three-gravities-top-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Extinción A", exact: true })
      .click();
    await seek(page, 8);
    await expect(page.locator(".qualitative-grid")).toContainText(
      "Apagada en la ilustración",
    );
    await page
      .getByText("Ensayos y fuentes · contrastar con datos reales", {
        exact: true,
      })
      .click();
    await expect(page.locator(".nearest-trials")).toContainText(
      "Catálogo de demostración",
    );
    await expect(page.locator(".nearest-trial")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/three-gravities-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Presión numérica A", { exact: true }).fill("0");
    await expect(page.locator(".vacuum-notice")).toHaveCount(3);
    await expect(page.locator(".qualitative-grid")).toContainText(
      "Sin gas · sin llama",
    );
    await page
      .getByRole("button", { name: "⊕ Comparar A/B", exact: true })
      .click();
    await expect(page.locator(".scene-view")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Tres gravedades", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });
}

test("three-gravity comparison remains usable without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#dashboard");
  await page
    .getByRole("button", { name: "Tres gravedades", exact: true })
    .click();
  for (const slot of ["A", "B", "C"])
    await expect(page.getByTestId(`svg-scene-${slot}`)).toBeVisible();
  await page.getByLabel("Presión numérica A", { exact: true }).fill("0");
  for (const slot of ["A", "B", "C"])
    await expect(page.getByTestId(`svg-scene-${slot}`)).toContainText(
      "Cámara sin gas",
    );
});
