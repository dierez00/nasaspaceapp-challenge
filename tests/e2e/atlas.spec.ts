import { test, expect, type Locator } from "@playwright/test";
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
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "El fuego, en otra gravedad." }),
    ).toBeVisible();
    await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
    await expect(page.locator("canvas[data-fps]")).toHaveCount(1, {
      timeout: 15000,
    });
    const singleFps = Number(
      await page.locator("canvas").getAttribute("data-fps"),
    );
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
      "ESCENARIO HIPOTÉTICO",
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
      await page.locator("canvas").getAttribute("data-fps"),
    );
    console.log(JSON.stringify({ viewport, singleFps, comparisonFps }));
    expect(singleFps).toBeGreaterThanOrEqual(viewport.width < 1024 ? 30 : 45);
    expect(comparisonFps).toBeGreaterThanOrEqual(
      viewport.width < 1024 ? 30 : 45,
    );
    await page.getByRole("button", { name: "Pausar simulación" }).click();
    await expect(page.locator("canvas")).not.toHaveAttribute(
      "data-draw-calls",
      "0",
    );
    await page.screenshot({
      path: `test-results/comparison-${viewport.width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
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
    if (viewport.width < 1024)
      await page
        .getByRole("button", { name: "✳ Copiloto", exact: true })
        .click();
    await page
      .getByRole("button", { name: "↔Comparar µg vs 1g", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir comparación 3D", exact: false })
      .click();
    await expect(page.getByTestId("scene-A")).toContainText("DEMO-001");
    await expect(page.getByTestId("scene-B")).toContainText("DEMO-004");
    expect(errors).toEqual([]);
  });
}
test("explicit states, vacuum, keyboard and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
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
  await page.goto("/");
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
    page.getByText("Sonda situada en 10.2 psi", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explorar 1/6g", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "1/6g A", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("clock suspends on map and hidden document", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Reiniciar simulación" }).click();
  await page.getByRole("tab", { name: "Mapa de evidencias" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: "Laboratorio", exact: true }).click();
  const time = await page.getByTestId("simulation-time").innerText();
  expect(parseFloat(time)).toBeLessThan(0.6);
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
  await page.goto("/");
  await expect(page.locator('canvas[data-renderer="webgl"]')).toHaveCount(1);
  await page
    .locator("canvas")
    .evaluate((canvas) =>
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
  await page.goto("/");
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
  await page.goto("/");
  await page
    .getByRole("button", { name: "ϟSólidos > 30% O₂", exact: true })
    .click();
  await expect(page.getByText("Respuesta incompleta.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Abrir en laboratorio 3D/ }),
  ).toBeVisible();
  await page.unroute("**/api/atlas/query");
  await page.route("**/api/atlas/query", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  await page
    .getByRole("button", { name: "↔Comparar µg vs 1g", exact: true })
    .click();
  await expect(page.locator(".chat-error")).toContainText("No se completó");
  await page.unroute("**/api/atlas/query");
  await page.getByRole("button", { name: "Reintentar consulta ↻" }).click();
  await expect(
    page.getByRole("button", { name: /Abrir comparación 3D/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "⌁Análogos E-FIELD", exact: true })
    .click();
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
  await page.goto("/");
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
