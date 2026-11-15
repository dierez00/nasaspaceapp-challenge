import { test, expect, type Locator, type Page } from "@playwright/test";
async function slider(locator: Locator, value: number) {
  await locator.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
// `/#dashboard` is the deep link straight to the deck: no cabin, no dive.
async function openAtlas(page: Page) {
  await page.goto("/#dashboard");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-phase",
    "deck",
  );
}
async function openEvidence(page: Page) {
  const button = page.getByRole("button", {
    name: "Evidencia y asistente",
    exact: true,
  });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}
const phase = (page: Page) => page.locator(".experience");
// The hero backdrop is a second canvas, so scope lab assertions to the lab renderer.
const labCanvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`immersive laboratory ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /Shader|WebGL|THREE/.test(message.text())
      )
        errors.push(message.text());
    });
    await openAtlas(page);
    await expect(
      page.getByRole("heading", { name: "El fuego, en otra gravedad." }),
    ).toBeVisible();
    await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
    await expect(page.locator("canvas[data-fps]")).toHaveCount(1, {
      timeout: 15000,
    });
    const singleFps = Number(await labCanvas(page).getAttribute("data-fps"));
    await page.screenshot({
      path: `test-results/laboratory-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "Pausar simulación" }).click();
    await slider(
      page.getByRole("slider", { name: "Progreso de simulación" }),
      4,
    );
    await page.getByRole("button", { name: "⊕ Comparar A/B" }).click();
    if (viewport.width < 1024)
      await page
        .getByRole("button", { name: "Escenario B", exact: true })
        .click();
    await page.getByLabel("Oxígeno numérica B", { exact: true }).fill("45");
    await page.getByRole("button", { name: "1g B", exact: true }).click();
    await expect(page.getByTestId("scene-B")).toContainText("45.0");
    await expect(page.getByTestId("scene-B")).toContainText(
      "Escenario hipotético",
    );
    await expect(page.getByTestId("simulation-time")).toContainText("4.0");
    if (viewport.width < 1024)
      await page
        .getByRole("button", { name: "Escenario A", exact: true })
        .click();
    await expect(
      page.getByLabel("Oxígeno numérica A", { exact: true }),
    ).toHaveValue("32");
    await page
      .getByRole("button", { name: "Reiniciar simulación", exact: true })
      .click();
    await page.waitForTimeout(2400);
    const comparisonFps = Number(
      await labCanvas(page).getAttribute("data-fps"),
    );
    console.log(JSON.stringify({ viewport, singleFps, comparisonFps }));
    await page.getByRole("button", { name: "Pausar simulación" }).click();
    await expect(labCanvas(page)).not.toHaveAttribute("data-draw-calls", "0");
    await page.screenshot({
      path: `test-results/comparison-${viewport.width}.png`,
    });
    // The atlas fills one viewport; the cabin is a separate fixed layer.
    expect(
      await page.evaluate(() => {
        const atlas = document.querySelector(".atlas-app")!;
        return atlas.scrollHeight <= atlas.clientHeight + 1;
      }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "⇄ Intercambiar A/B" }).click();
    await expect(
      page.getByLabel("Oxígeno numérica A", { exact: true }),
    ).toHaveValue("45");
    await page
      .getByRole("button", { name: "Restaurar A", exact: true })
      .click();
    await expect(
      page.getByLabel("Oxígeno numérica A", { exact: true }),
    ).toHaveValue("32");
    await page.getByRole("button", { name: "✕ Cerrar A/B" }).click();
    await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
    await page.getByTestId("node-DEMO-004").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scene-A")).toContainText("DEMO-004");
    await openEvidence(page);
    await page.getByRole("button", { name: /Compara µg vs 1g/ }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: /Simular PMMA a 1\/6 g/ }).click();
    await expect(
      page.getByRole("button", { name: "1/6g A", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
    // Keep the hardware budget intact, after functional regression coverage.
    expect(singleFps).toBeGreaterThanOrEqual(viewport.width < 1024 ? 30 : 45);
    expect(comparisonFps).toBeGreaterThanOrEqual(
      viewport.width < 1024 ? 30 : 45,
    );
  });
}
test("explicit states, vacuum, keyboard and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAtlas(page);
  await expect(
    page.getByRole("button", { name: "Reproducir simulación" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Extinción A", exact: true }).click();
  await expect(page.getByTestId("simulation-time")).toContainText("0.0");
  await slider(page.getByRole("slider", { name: "Progreso de simulación" }), 8);
  await page.getByLabel("Presión numérica A", { exact: true }).fill("0");
  await expect(page.locator(".vacuum-notice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extinción A", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Propagación A", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("simulation-time")).toContainText("0.0");
  await expect(
    page.getByRole("button", { name: "Reproducir simulación" }),
  ).toBeVisible();
});
test("map collision selection and lunar probe preserve chat integration", async ({
  page,
}) => {
  await openAtlas(page);
  await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
  await page.getByTestId("node-DEMO-002").focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "DEMO-003 · Nomex", exact: true })
    .click();
  await expect(page.getByTestId("scene-A")).toContainText("Nomex");
  await expect(
    page.getByRole("button", { name: "Extinción A", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
  await page.getByText("Sonda por coordenadas", { exact: false }).click();
  await page.getByLabel("Presión de la sonda").fill("10.2");
  await page.getByLabel("Oxígeno de la sonda").fill("30");
  await page.getByRole("button", { name: "Consultar punto →" }).click();
  await expect(
    page.getByRole("heading", {
      name: /No hay evidencia en gravedad lunar para 10.2 psi/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Simular este punto en el laboratorio/ })
    .click();
  await expect(
    page.getByRole("button", { name: "1/6g A", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("clock suspends on map and hidden document", async ({ page }) => {
  await openAtlas(page);
  await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Reiniciar simulación" }).click();
  await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: "Laboratorio", exact: true }).click();
  const time = await page.getByTestId("simulation-time").innerText();
  // The sim clock is suspended on the map, so the 800 ms away must not show up here
  // (only the click latency before leaving the lab view may).
  expect(parseFloat(time)).toBeLessThan(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(200);
  const paused = await page.getByTestId("simulation-time").innerText();
  await page.waitForTimeout(400);
  expect(await page.getByTestId("simulation-time").innerText()).toBe(paused);
});
test("WebGL loss falls back to SVG and can retry", async ({ page }) => {
  await openAtlas(page);
  await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
  await labCanvas(page).evaluate((canvas) =>
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(
    page.getByText("La cámara 3D no está disponible.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Presión numérica A", { exact: true }).fill("0");
  await expect(page.getByTestId("svg-scene-A")).toContainText("Cámara sin gas");
  await page.getByRole("button", { name: "Reintentar 3D" }).click();
  await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
});
test("no WebGL still exposes usable controls", async ({ page }) => {
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
  await openAtlas(page);
  await expect(page.getByTestId("svg-scene-A")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "1g A", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1g A", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("invalid block isolated, error retry and cancellation", async ({
  page,
}) => {
  await page.route("**/api/atlas/query", async (route) => {
    const { queryId } = route.request().postDataJSON();
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "ui-block", queryId, block: { type: "Unknown" } },
        {
          type: "ui-block",
          queryId,
          block: { type: "ExperimentCard", experimentId: "DEMO-001" },
        },
        { type: "done", queryId },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });
  await openAtlas(page);
  await openEvidence(page);
  await page.getByRole("button", { name: /¿Hay ensayos de sólidos/ }).click();
  await expect(page.getByText("Respuesta incompleta.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Abrir en laboratorio 3D/ }),
  ).toBeVisible();
  await page.unroute("**/api/atlas/query");
  await page.route("**/api/atlas/query", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  await page.getByRole("button", { name: /Compara µg vs 1g/ }).click();
  await expect(page.locator(".chat-error")).toContainText("No se completó");
  await page.unroute("**/api/atlas/query");
  await page.getByRole("button", { name: "Reintentar consulta ↻" }).click();
  await expect(
    page.getByRole("button", { name: /Simular PMMA a 1\/6 g/ }),
  ).toBeVisible();
  await page.route("**/api/atlas/query", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route
      .fulfill({ status: 503, body: "cancelled test" })
      .catch(() => {});
  });
  await page.getByRole("button", { name: /Sólidos con más/ }).click();
  await page.getByRole("button", { name: "Cancelar consulta" }).click();
  await expect(
    page.getByText("Consulta cancelada.", { exact: false }),
  ).toBeVisible();
});
test("API remains compatible", async ({ request }) => {
  const response = await request.get("/api/atlas/experiments");
  expect(response.status()).toBe(200);
  expect(await response.json()).toHaveLength(12);
  expect(
    (await request.post("/api/atlas/query", { data: { text: "" } })).status(),
  ).toBe(400);
});

test("linked orbit and reset keep A and B aligned", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAtlas(page);
  await page.getByRole("button", { name: "⊕ Comparar A/B" }).click();
  const a = page.getByTestId("scene-A"),
    b = page.getByTestId("scene-B");
  await expect(a).toHaveAttribute("data-camera-position", /,/);
  await page.getByRole("button", { name: "Pausar simulación" }).click();
  const initial = await a.getAttribute("data-camera-position");
  const box = (await a.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.5 + 55,
    box.y + box.height * 0.5 + 15,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(() => a.getAttribute("data-camera-position"))
    .not.toBe(initial);
  await expect
    .poll(
      async () =>
        (await a.getAttribute("data-camera-position")) ===
        (await b.getAttribute("data-camera-position")),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Restablecer cámara" }).click();
  await expect(a).toHaveAttribute("data-camera-position", "2.800,1.800,4.400");
  await expect(b).toHaveAttribute("data-camera-position", "2.800,1.800,4.400");
});

test.describe("cabin and immersion", () => {
  test("cabin has no scroll path to the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(phase(page)).toHaveAttribute("data-phase", "cabin");
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 3000);
    await page.keyboard.press("PageDown");
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => ({
        y: scrollY,
        scrollable:
          document.documentElement.scrollHeight >
          document.documentElement.clientHeight,
      })),
    ).toEqual({ y: 0, scrollable: false });
    await expect(page.locator("#dashboard")).toHaveAttribute("inert", "");
    await expect(page.locator(".atlas-app")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Atlas del fuego lunar" }),
    ).toBeVisible();
  });

  test("the CTA dives into the deck and moves focus to it", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Comenzar inmersión" }).click();
    await expect(phase(page)).toHaveAttribute("data-phase", "diving");
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 6000,
    });
    await expect(page.locator("#dashboard")).toBeFocused();
    await expect(page.locator("#dashboard")).not.toHaveAttribute("inert", "");
    await expect(
      page.getByRole("heading", { name: "El fuego, en otra gravedad." }),
    ).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe("#dashboard");
    // Cabin leaves the accessibility tree: still exactly one reachable h1 or none.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  });

  test("Esc skips the dive to its end state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Comenzar inmersión" }).click();
    await page.waitForTimeout(450);
    await expect(phase(page)).toHaveAttribute("data-phase", "diving");
    await page.keyboard.press("Escape");
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 600,
    });
    await expect(page.locator("#dashboard")).toBeFocused();
  });

  test("a click skips the dive without clicking the deck", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Comenzar inmersión" }).click();
    await page.waitForTimeout(450);
    // Lands where the "Mapa de evidencias" tab will be once the deck is up.
    await page.mouse.click(780, 34);
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 600,
    });
    await expect(
      page.getByRole("tab", { name: "Laboratorio", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("Volver a la cabina returns to the cabin and focuses the CTA", async ({
    page,
  }) => {
    await openAtlas(page);
    await page.getByRole("button", { name: "Volver a la cabina" }).click();
    await expect(phase(page)).toHaveAttribute("data-phase", "returning");
    await expect(phase(page)).toHaveAttribute("data-phase", "cabin", {
      timeout: 3000,
    });
    await expect(
      page.getByRole("button", { name: "Comenzar inmersión" }),
    ).toBeFocused();
    await expect(page.locator(".atlas-app")).toBeHidden();
    expect(await page.evaluate(() => location.hash)).toBe("");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    // And the CTA works again.
    await page.getByRole("button", { name: "Comenzar inmersión" }).click();
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 6000,
    });
  });

  test("skip link arrives instantly and focuses the dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al Atlas" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 300,
    });
    await expect(page.locator("#dashboard")).toBeFocused();
  });

  test("reduced motion crossfades in about 300 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Comenzar inmersión" }).click();
    await expect(phase(page)).toHaveAttribute("data-phase", "deck", {
      timeout: 1200,
    });
    await expect(page.locator("#dashboard")).toBeFocused();
  });
});
