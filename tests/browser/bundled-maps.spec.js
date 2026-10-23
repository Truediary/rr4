import { test, expect } from "@playwright/test";

test("real bundled maps load on a fresh installation and appear in the library", async ({ page, request }) => {
  const maps = await (await request.get("/api/maps")).json();
  expect(Object.keys(maps)).toHaveLength(16);
  for (const config of Object.values(maps)) {
    expect(config.calibrated).toBe(false);
    expect(config).not.toHaveProperty("minX");
  }
  await page.goto("/?water=amber");
  const card = page.locator('[data-water="amber"]');
  await expect(card.locator(".real-water-map")).toHaveJSProperty("naturalWidth", 800);
  await expect(card.locator(".map-status-badge")).toHaveText("Карта из комплекта");
  await expect(card.getByRole("link", { name: "Открыть оригинал: Озеро Янтарное" })).toHaveAttribute("href", "/maps/amber.png");
  const originalOpened = page.waitForEvent("popup");
  await card.getByRole("link", { name: "Открыть оригинал: Озеро Янтарное" }).click();
  const original = await originalOpened;
  await original.waitForLoadState("domcontentloaded");
  expect(new URL(original.url()).pathname).toBe("/maps/amber.png");
  await original.close();
  await expect(card.locator(".cluster-marker")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Водоём", exact: true }).selectOption("ladoga-archipelago");
  await expect(page.locator('[data-water="ladoga-archipelago"] .real-water-map')).toHaveJSProperty("naturalWidth", 800);
  await page.getByRole("button", { name: "Фото и карты", exact: true }).click();
  await page.getByLabel("Фильтр материалов").selectOption("map");
  await expect(page.locator(".media-gallery > article")).toHaveCount(16);
  await expect(page.locator(".media-gallery")).toContainText("Архив пользователя «рр4 карт.rar»");
});

test("custom map calibration survives defaults and bundled maps can be disabled and restored", async ({ page, request }) => {
  for (const waterId of ["copper", "constructor", "__proto__"]) {
    const missing = await request.post(`/api/maps/${waterId}/reset`, { data: {} });
    expect(missing.status()).toBe(404);
  }
  const custom = { url: "/maps/mosquito.png", calibrated: true, minX: 1, maxX: 200, minY: 2, maxY: 200, flipY: true };
  expect((await request.put("/api/maps/mosquito", { data: custom })).status()).toBe(200);
  expect((await (await request.get("/api/maps")).json()).mosquito.minX).toBe(1);
  await page.goto("/?water=mosquito");
  await page.getByRole("button", { name: "Настроить карту: Озеро Комариное" }).click();
  const dialog = page.getByRole("dialog", { name: "Настройка карты" });
  await expect(dialog.getByLabel("Наложить точки по игровым координатам")).toBeChecked();
  await expect(dialog.getByLabel("X слева", { exact: true })).toHaveValue("1");
  await dialog.getByRole("button", { name: "Отключить карту", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-water="mosquito"] .real-water-map')).toHaveCount(0);
  expect((await (await request.get("/api/maps")).json()).mosquito).toBeUndefined();
  await page.getByRole("button", { name: "Настроить карту: Озеро Комариное" }).click();
  await dialog.getByRole("button", { name: "Восстановить карту из комплекта" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-water="mosquito"] .real-water-map')).toHaveJSProperty("naturalWidth", 800);
  await page.reload();
  const restored = (await (await request.get("/api/maps")).json()).mosquito;
  expect(restored.calibrated).toBe(false);
  expect(restored).not.toHaveProperty("minX");
});
