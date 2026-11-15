import { expect, test } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`instrument leads, evidence is contextual and controls fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#dashboard");
    await expect(page.locator("#contextual-evidence")).toBeHidden();
    await expect(page.locator(".loading-screen-failsafe")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "El fuego, en otra gravedad." }),
    ).toBeVisible();
    await expect(page.locator(".atlas-brand .atlas-mark")).toBeVisible();
    await page
      .getByText("Exploración guiada: cambia una sola variable", {
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Reducir presión en 2 psi" })
      .click();
    await expect(
      page.getByLabel("Presión numérica A", { exact: true }),
    ).toHaveValue("6.2");
    await expect(
      page.getByLabel("Oxígeno numérica A", { exact: true }),
    ).toHaveValue("32");
    await page
      .getByRole("button", {
        name: "Comparar las tres gravedades",
        exact: true,
      })
      .click();
    await expect(page.locator(".scene-view")).toHaveCount(3);
    await page.screenshot({
      path: `test-results/observatory-guided-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Evidencia y asistente", exact: true })
      .click();
    await expect(page.locator("#contextual-evidence")).toBeVisible();
    await page
      .getByRole("button", {
        name: "Cerrar evidencia y asistente",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#contextual-evidence")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Evidencia y asistente", exact: true }),
    ).toBeFocused();
    await page
      .getByLabel("Perspectiva de exploración")
      .selectOption("researcher");
    await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
    await page.getByLabel("Filtrar material").selectOption("PMMA");
    await page.getByLabel("Oxígeno mínimo", { exact: true }).fill("40");
    await expect(page.locator(".map-count")).toContainText("1 / 12");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar 1 ensayos CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("atlas-filtered-trials.csv");
    await page.screenshot({
      path: `test-results/observatory-research-${width}.png`,
    });
    expect(
      await page.evaluate(() => {
        const elements = [
          document.querySelector(".atlas-topbar")!,
          document.querySelector(".workspace-context")!,
          document.querySelector(".deck")!,
        ];
        return elements.every(
          (element) =>
            element.scrollWidth <= element.clientWidth + 1 &&
            element.scrollLeft === 0,
        );
      }),
    ).toBe(true);
  });
}
test("entry stays dark, short and omissible, with one shared emblem", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".cabin-mark .atlas-mark")).toBeVisible();
  await page.getByRole("button", { name: "Comenzar inmersión" }).click();
  await page.waitForTimeout(350);
  await expect(page.locator(".bloom")).toBeHidden();
  await expect(page.locator(".veil")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-phase",
    "deck",
    { timeout: 1200 },
  );
  await expect(page.locator("#dashboard")).toBeFocused();
});

test("contextual briefs retain exact tables, CSV, citations and map actions", async ({
  page,
}) => {
  await page.goto("/#dashboard");
  await page
    .getByRole("button", { name: "Evidencia y asistente", exact: true })
    .click();
  await page.getByRole("button", { name: /¿Hay ensayos de sólidos/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar cita", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar CSV", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "atlas-evidencia.csv",
  );
  await page.getByRole("button", { name: "Copiar cita", exact: true }).click();
  await expect(
    page.getByText("Cita copiada al portapapeles.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/observatory-evidence.png" });
  await page.getByRole("button", { name: /Ver en el mapa/ }).click();
  await expect(page.locator(".node-highlight").first()).toBeVisible();
  await page.getByRole("button", { name: /Ver hueco en el mapa/ }).click();
  await expect(page.getByTestId("gap-overlay")).toBeVisible();
});

test("evidence focus reveals filtered matches explicitly without losing researcher filters", async ({
  page,
}) => {
  await page.goto("/#dashboard");
  await page
    .getByLabel("Perspectiva de exploración")
    .selectOption("researcher");
  await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
  await page.getByLabel("Filtrar material").selectOption("Nomex");
  await page.getByLabel("Presión máxima", { exact: true }).fill("0");
  await page.getByLabel("Oxígeno mínimo", { exact: true }).fill("40");
  await page.getByLabel("Oxígeno máximo", { exact: true }).fill("45");
  await page.getByRole("button", { name: "1g Tierra", exact: true }).click();
  await expect(page.locator(".map-count")).toContainText("0 / 12");
  await page
    .getByRole("button", { name: "Evidencia y asistente", exact: true })
    .click();
  await page.getByRole("button", { name: /¿Hay ensayos de sólidos/ }).click();
  await page.getByRole("button", { name: /Ver en el mapa/ }).click();
  await expect(page.locator(".overlay-banner")).toContainText(
    "0 ensayos resaltados",
  );
  await expect(page.locator(".overlay-banner")).toContainText(
    "6 ensayos de la ficha ocultos por tus filtros",
  );
  await expect(page.locator(".node-highlight")).toHaveCount(0);
  const reveal = page.getByRole("button", {
    name: "Mostrar ensayos ocultos",
    exact: true,
  });
  await expect(reveal).toBeFocused();
  await expect(reveal).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".node-highlight")).toHaveCount(6);
  await expect(page.locator(".overlay-banner")).toContainText(
    "6 ensayos resaltados",
  );
  await expect(page.locator(".overlay-banner")).not.toContainText(
    "ocultos por tus filtros",
  );
  await expect(page.locator(".map-count")).toContainText("6 / 12");
  await expect(page.getByLabel("Filtrar material")).toHaveValue("Nomex");
  await expect(page.getByLabel("Presión máxima", { exact: true })).toHaveValue(
    "0",
  );
  await expect(page.getByLabel("Oxígeno mínimo", { exact: true })).toHaveValue(
    "40",
  );
  await expect(page.getByLabel("Oxígeno máximo", { exact: true })).toHaveValue(
    "45",
  );
  await expect(
    page.getByRole("button", { name: "1g Tierra", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Exportar 0 ensayos CSV" }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/evidence-filter-reveal.png" });
  await page
    .getByRole("button", { name: "Volver a mis filtros", exact: true })
    .click();
  await expect(page.locator(".node-highlight")).toHaveCount(0);
  await expect(page.locator(".map-count")).toContainText("0 / 12");
  await expect(page.locator(".overlay-banner")).toContainText(
    "0 ensayos resaltados",
  );
});
