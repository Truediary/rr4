import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kYz8AAAAASUVORK5CYII=",
  "base64",
);
test("normal visitors see real records and no generated maps or demo toggle", async ({
  page,
  request,
}) => {
  const real = await (await request.get("/api/reports")).json();
  const calls = [];
  page.on("request", (r) => calls.push(r.url()));
  await page.goto("/");
  await expect(page.getByTestId("stat-posts")).toHaveText(String(real.length));
  expect(calls.some((url) => url.includes("demo=true"))).toBe(false);
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.locator(".fish-picture")).toHaveCount(0);
  await expect(page.locator(".reference-map-content > svg")).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});
test("a screenshot uploads, serves safely and remains attached after reload", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить точку", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Рыба", { exact: true }).fill("Окунь с фото");
  await dialog.getByLabel("Координата X").fill("44");
  await dialog.getByLabel("Координата Y").fill("30");
  await dialog.getByLabel("Наживка", { exact: true }).fill("Червь");
  await dialog.getByLabel("Ваш ник").fill("Фото-тест");
  await dialog
    .getByLabel("Файлы скриншотов")
    .setInputFiles({
      name: "screenshot.png",
      mimeType: "image/png",
      buffer: png,
    });
  await expect(dialog.getByLabel("Ссылки на скриншоты")).toHaveValue(
    /^\/media\/[a-f0-9-]+\.png$/,
  );
  const url = await dialog.getByLabel("Ссылки на скриншоты").inputValue();
  await dialog.getByRole("button", { name: "Опубликовать отчёт" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Лента отчётов" }).click();
  const card = page.locator(".catch-post").filter({ hasText: "Окунь с фото" });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".post-photo-preview img")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
  const image = await request.get(url);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect(image.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await image.body()).toEqual(png);
  await page.reload();
  await page.getByRole("button", { name: "Лента отчётов" }).click();
  await expect(
    page
      .locator(".catch-post")
      .filter({ hasText: "Окунь с фото" })
      .locator(".post-photo-preview img"),
  ).toHaveJSProperty("naturalWidth", 1);
});
test("library labels attach actual uploaded images to fish entries", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Фото и карты", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Фото и карты" }),
  ).toBeVisible();
  await page.getByLabel("Тип материала").selectOption("fish");
  await page
    .getByLabel("Название", { exact: true })
    .fill("Изображение из игры");
  await page.getByLabel("Название рыбы в отчётах").fill("Тестовый линь");
  await page
    .getByLabel("Файл материала")
    .setInputFiles({ name: "fish.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Сохранить материал" }).click();
  await expect(page.locator(".media-gallery")).toContainText(
    "Изображение из игры",
  );
  await page
    .getByRole("button", { name: "Точки клёва", exact: false })
    .first()
    .click();
  await expect(
    page.locator(".distribution-fish .catalog-game-image"),
  ).toHaveCount(1);
});
test("map uploads, library selection and source attribution persist", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Настроить карту: Озеро Медное" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Настройка карты" });
  await expect(dialog.getByRole("link", { name: "Карты на RF4MAP" }))
    .toHaveAttribute("href", "https://rf4map.ru/");
  await dialog
    .getByLabel("Файл карты")
    .setInputFiles({ name: "map.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByLabel("Адрес изображения")).toHaveValue(
    /^\/media\/[a-f0-9-]+\.png$/,
  );
  const url = await dialog.getByLabel("Адрес изображения").inputValue();
  await dialog.getByLabel("Страница источника карты").fill("https://rf4map.ru/");
  await dialog
    .getByRole("button", { name: "Сохранить карту", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('[data-water="copper"] .map-status-badge'),
  ).toHaveText("Карта пользователя");
  await page.reload();
  await expect(page.locator('[data-water="copper"]').getByRole("link", { name: "Источник", exact: true }))
    .toHaveAttribute("href", "https://rf4map.ru/");
  const saved = await (await request.get("/api/maps")).json();
  expect(saved.copper.sourceUrl).toBe("https://rf4map.ru/");
  for (const sourceUrl of ["not a URL", "javascript:alert(1)", "https://user:secret@example.com/"]) {
    const invalid = await request.put("/api/maps/copper", {
      data: { ...saved.copper, sourceUrl },
    });
    expect(invalid.status()).toBe(400);
  }
  await page.getByRole("button", { name: "Настроить карту: Озеро Куори" }).click();
  await dialog.getByLabel("Из библиотеки карт").selectOption(url);
  await expect(dialog.getByLabel("Адрес изображения")).toHaveValue(url);
  await dialog.getByRole("button", { name: "Сохранить карту", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-water="kuori"] .real-water-map'))
    .toHaveJSProperty("naturalWidth", 1);
  expect((await (await request.get("/api/maps")).json()).kuori.url).toBe(url);
  await request.delete("/api/maps/kuori", { data: {} });
});
test("active file formats and oversize uploads are rejected", async ({
  request,
}) => {
  const html = await request.post("/api/media", {
    multipart: {
      file: {
        name: "image.png",
        mimeType: "image/png",
        buffer: Buffer.from("<html><script>alert(1)</script></html>"),
      },
    },
  });
  expect(html.status()).toBe(400);
  const huge = await request.post("/api/media", {
    multipart: {
      file: {
        name: "large.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      },
    },
  });
  expect(huge.status()).toBe(413);
});
