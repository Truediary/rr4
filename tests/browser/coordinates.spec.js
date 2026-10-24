import { test, expect } from "@playwright/test";

test("coordinate search and personal pins do not create catch reports", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/reports")).json();
  await page.goto("/?water=old-burg");
  const card = page.locator('[data-water="old-burg"]');
  await expect(card.locator(".real-water-map")).toHaveJSProperty(
    "naturalWidth",
    800,
  );
  const input = card.getByLabel("Координаты: Озеро Старый Острог", {
    exact: true,
  });
  await input.fill("47:20");
  await card.getByRole("button", { name: "Найти точку", exact: true }).click();
  const target = card.getByTestId("map-target-old-burg");
  await expect(target).toHaveAttribute("aria-label", "Выбрано 47:20");
  await expect(target).toHaveAttribute("style", /left: 58\.75%/);
  await input.fill("999:999");
  await card.getByRole("button", { name: "Найти точку", exact: true }).click();
  await expect(target).toHaveAttribute("aria-label", "Выбрано 47:20");
  await expect(
    page.getByText("Эти координаты находятся за пределами карты", {
      exact: true,
    }),
  ).toBeVisible();
  await card
    .getByLabel("Название метки: Озеро Старый Острог")
    .fill("Мой берег");
  await card.getByRole("button", { name: "Сохранить мою метку" }).click();
  await page.reload();
  await expect(
    card.getByRole("button", { name: "Моя метка Мой берег: 47:20" }),
  ).toBeVisible();
  const after = await (await request.get("/api/reports")).json();
  expect(after).toHaveLength(before.length);
  await card
    .getByRole("button", { name: "Моя метка Мой берег: 47:20" })
    .click();
  await card.getByRole("button", { name: "Удалить мою метку" }).click();
  await page.reload();
  await expect(card.locator(".personal-map-pin")).toHaveCount(0);
});

test("zoomed and panned clicks prefill the report in game coordinates", async ({
  page,
}) => {
  await page.goto("/?water=old-burg");
  const card = page.locator('[data-water="old-burg"]');
  await expect(card.locator(".real-water-map")).toHaveJSProperty(
    "naturalWidth",
    800,
  );
  await card
    .getByRole("button", { name: "Увеличить: Озеро Старый Острог" })
    .click();
  const viewport = await card.locator(".reference-map").boundingBox();
  await page.mouse.move(
    viewport.x + viewport.width / 2,
    viewport.y + viewport.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    viewport.x + viewport.width / 2 + 30,
    viewport.y + viewport.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(card.locator(".map-target-marker")).toHaveCount(0);
  const raster = await card.locator(".map-raster-layer").boundingBox();
  await page.mouse.click(
    raster.x + raster.width / 2,
    raster.y + raster.height / 2,
  );
  await expect(card.getByTestId("map-target-old-burg")).toHaveAttribute(
    "aria-label",
    "Выбрано 40:41",
  );
  await card.getByRole("button", { name: "Добавить отчёт в точке" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Водоём", { exact: true })).toHaveValue(
    "old-burg",
  );
  await expect(dialog.getByLabel("Координата X")).toHaveValue("40");
  await expect(dialog.getByLabel("Координата Y")).toHaveValue("41");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByTestId("map-target-old-burg").scrollIntoViewIfNeeded();
  const resized = await card.locator(".map-raster-layer").boundingBox();
  const target = await card.getByTestId("map-target-old-burg").boundingBox();
  expect(
    Math.abs((target.x + target.width / 2 - resized.x) / resized.width - 0.5),
  ).toBeLessThan(0.003);
  expect(
    Math.abs((target.y + target.height / 2 - resized.y) / resized.height - 0.5),
  ).toBeLessThan(0.003);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("two game control points produce a persistent calibration for an uncalibrated map", async ({
  page,
  request,
}) => {
  await request.post("/api/maps/norwegian-sea/reset", { data: {} });
  try {
    await page.goto("/?water=norwegian-sea");
    const card = page.locator('[data-water="norwegian-sea"]');
    await expect(
      card.getByLabel("Координаты: Норвежское море", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Настроить карту: Норвежское море" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Настройка карты" });
    await dialog
      .getByRole("button", { name: "Настроить по двум точкам из игры" })
      .click();
    const preview = dialog.locator(".control-point-image");
    await expect(preview.locator("img")).toHaveJSProperty("naturalWidth", 800);
    const box = await preview.boundingBox();
    await preview.click({
      position: { x: box.width * 0.2, y: box.height * 0.2 },
    });
    await preview.click({
      position: { x: box.width * 0.8, y: box.height * 0.8 },
    });
    // Deliberate technical control points in the isolated test DB, not game evidence.
    await dialog.getByLabel("Точка 1: X из игры").fill("200");
    await dialog.getByLabel("Точка 1: Y из игры").fill("800");
    await dialog.getByLabel("Точка 2: X из игры").fill("800");
    await dialog.getByLabel("Точка 2: Y из игры").fill("200");
    await dialog
      .getByRole("button", { name: "Применить привязку", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Наложить точки по игровым координатам"),
    ).toBeChecked();
    await dialog
      .getByRole("button", { name: "Сохранить карту", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const config = (await (await request.get("/api/maps")).json())[
      "norwegian-sea"
    ];
    expect(config.calibrated).toBe(true);
    expect(config.coordinateSource.kind).toBe("control-points");
    expect(config.coordinateSource.controlPoints).toHaveLength(2);
    expect(config.maxX - config.minX).toBeGreaterThan(995);
    expect(config.maxX - config.minX).toBeLessThan(1005);
    const invalid = await request.put("/api/maps/norwegian-sea", {
      data: {
        ...config,
        coordinateSource: {
          ...config.coordinateSource,
          controlPoints: [
            { u: 2, v: 0, x: 0, y: 0 },
            { u: 1, v: 1, x: 1, y: 1 },
          ],
        },
      },
    });
    expect(invalid.status()).toBe(400);
    await page.reload();
    await expect(
      card.getByLabel("Координаты: Норвежское море", { exact: true }),
    ).toBeEnabled();
  } finally {
    await request.post("/api/maps/norwegian-sea/reset", { data: {} });
  }
});

test("changing the map image clears the old image's coordinate calibration", async ({
  page,
}) => {
  await page.goto("/?water=mosquito");
  await page
    .getByRole("button", { name: "Настроить карту: Озеро Комариное" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Настройка карты" });
  await expect(
    dialog.getByLabel("Наложить точки по игровым координатам"),
  ).toBeChecked();
  await dialog.getByLabel("Адрес изображения").fill("/maps/amber.png");
  await expect(
    dialog.getByLabel("Наложить точки по игровым координатам"),
  ).not.toBeChecked();
  await expect(dialog.getByLabel("X слева", { exact: true })).toHaveCount(0);
});
