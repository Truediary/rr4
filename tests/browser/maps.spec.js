import { test, expect } from "@playwright/test";

test("reference maps keep reports accessible and require real bounds before placing markers", async ({ page, request }) => {
  // Technical upload fixture, never included in the actual game asset library.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kYz8AAAAASUVORK5CYII=", "base64");
  const upload = await request.post("/api/media", { multipart: {
    kind: "map", label: "Технический тест карты",
    file: { name: "calibration-fixture.png", mimeType: "image/png", buffer: png },
  } });
  expect(upload.status()).toBe(201);
  const { url } = await upload.json();
  const oldFormat = { url, minX: 0, maxX: 300, minY: 0, maxY: 300, flipY: true };
  const legacy = await request.put("/api/maps/amber", { data: oldFormat });
  expect(legacy.status()).toBe(200);
  expect((await legacy.json()).calibrated).toBe(true);
  const reference = await request.put("/api/maps/amber", { data: { url, calibrated: false } });
  expect(reference.status()).toBe(200);
  expect(await reference.json()).not.toHaveProperty("minX");
  const invalid = await request.put("/api/maps/amber", { data: { url, calibrated: true } });
  expect(invalid.status()).toBe(400);
  await page.goto("/?demo=true");
  const card = page.locator('[data-water="amber"]');
  await expect(card.locator(".real-water-map")).toHaveJSProperty("naturalWidth", 1);
  await expect(card.locator(".real-water-map")).toHaveCSS("object-fit", "contain");
  await expect(card.locator(".map-caption")).toHaveText("Координатная привязка не задана");
  await expect(card.locator(".cluster-marker")).toHaveCount(0);
  await expect(card.locator(".unmapped-points button")).toHaveCount(1);
  await card.locator(".unmapped-points button").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Точка 83:145");
  await page.getByRole("button", { name: "Закрыть отчёты" }).click();
  await card.getByRole("button", { name: "Увеличить: Озеро Янтарное" }).click();
  await expect(card.locator(".reference-map-content")).toHaveAttribute("style", /scale\(1\.5\)/);
  await page.getByRole("button", { name: "Настроить карту: Озеро Янтарное" }).click();
  const dialog = page.getByRole("dialog", { name: "Настройка карты" });
  const checkbox = dialog.getByLabel("Наложить точки по игровым координатам");
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(dialog.getByLabel("X слева", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "Сохранить карту", exact: true }).click();
  await expect(dialog).toBeVisible();
  for (const [label, value] of [["X слева", "0"], ["X справа", "300"], ["Минимальная Y", "0"], ["Максимальная Y", "300"]]) {
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  await dialog.getByRole("button", { name: "Сохранить карту", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.locator(".cluster-marker")).toHaveCount(1);
  await expect(card.locator(".unmapped-points")).toHaveCount(0);
  await page.reload();
  await expect(card.locator(".cluster-marker")).toHaveCount(1);
  await request.put("/api/maps/amber", { data: { url, calibrated: false } });
  await page.reload();
  await expect(card.locator(".real-water-map")).toHaveJSProperty("naturalWidth", 1);
  await expect(card.locator(".cluster-marker")).toHaveCount(0);
  await expect(card.locator(".unmapped-points button")).toHaveCount(1);
  await request.delete("/api/maps/amber", { data: {} });
});
