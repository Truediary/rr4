import { test, expect } from "@playwright/test";
test("reference statistics, water maps, point modal and favorites work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Точки клёва и статистика" }),
  ).toBeVisible();
  await expect(page.locator(".water-stat-card")).toHaveCount(12);
  await page
    .getByRole("combobox", { name: "Водоём", exact: true })
    .selectOption("old-burg");
  await page
    .getByRole("combobox", { name: "Рыба", exact: true })
    .selectOption("Линь");
  await expect(page.getByTestId("stat-posts")).toHaveText("1");
  await expect(page.getByTestId("stat-catches")).toHaveText("21");
  await expect(page.locator(".water-stat-card")).toHaveCount(1);
  await page.locator(".distribution-point .distribution-item").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Точка 47:20");
  await expect(dialog.locator(".catch-post")).toHaveCount(1);
  await dialog.getByRole("button", { name: "В избранное: Линь" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Избранное", exact: false })
    .first()
    .click();
  await expect(page.locator(".report-card")).toHaveCount(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Избранное", exact: false })
    .first()
    .click();
  await expect(page.locator(".report-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("point statistics and clip filters update post cards; graph renders", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('[data-water="norwegian-sea"] .cluster-marker.red')
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Точка 34");
  await expect(dialog.locator(".catch-post")).toHaveCount(4);
  await expect(dialog.getByTestId("stat-posts")).toHaveText("4");
  await expect(dialog.getByTestId("stat-catches")).toHaveText("19");
  await dialog.locator(".distribution-clip .distribution-item").first().click();
  await expect(dialog.locator(".catch-post")).toHaveCount(1);
  await expect(dialog.getByTestId("stat-posts")).toHaveText("1");
  await dialog.getByRole("button", { name: /Клипса:/ }).click();
  await expect(dialog.locator(".catch-post")).toHaveCount(4);
  await dialog.getByRole("button", { name: "График", exact: true }).click();
  await expect(
    dialog.getByRole("img", { name: "График: уловы по времени" }),
  ).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Показатель графика" })
    .selectOption("posts");
  await expect(
    dialog.getByRole("img", { name: "График: посты по времени" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Другие фильтры" }).click();
  await expect(
    dialog.getByRole("combobox", { name: "Дополнительная снасть" }),
  ).toBeVisible();
});
test("searches save and restore filters after reload", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Водоём", exact: true })
    .selectOption("copper");
  await expect(page.getByTestId("stat-posts")).toHaveText("6");
  await page
    .getByRole("button", { name: "Сохранить поиск", exact: true })
    .click();
  await expect(page.locator(".saved-searches")).toContainText("Озеро Медное");
  await page.reload();
  await page.locator(".saved-searches button").first().click();
  await expect(
    page.getByRole("combobox", { name: "Водоём", exact: true }),
  ).toHaveValue("copper");
  await expect(page.getByTestId("stat-posts")).toHaveText("6");
});
test("real report metrics and screenshots persist, with no demo pollution", async ({
  page,
  request,
}) => {
  await page.route("https://example.com/catch.jpg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="green"/></svg>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить точку", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Рыба", { exact: true }).fill("Тестовый линь");
  await dialog.getByLabel("Координата X").fill("47");
  await dialog.getByLabel("Координата Y").fill("20");
  await dialog.getByLabel("Наживка", { exact: true }).fill("Тестовое тесто");
  await dialog.getByLabel("Ваш ник").fill("Тестовый рыболов");
  await dialog.locator("summary").click();
  await dialog.getByLabel("Суммарный вес улова, г").fill("1500");
  await dialog.getByLabel("Доход, серебра").fill("100");
  await dialog.getByLabel("Время рыбалки, мин").fill("30");
  await dialog
    .getByLabel("Ссылки на скриншоты")
    .fill("https://example.com/catch.jpg");
  await dialog.getByRole("button", { name: "Опубликовать отчёт" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("switch")).not.toBeChecked();
  await expect(page.getByTestId("stat-posts")).toHaveText("1");
  await expect(page.getByTestId("stat-average")).toHaveText("1 500 г");
  await expect(page.getByTestId("stat-farm")).toHaveText("200");
  await page.getByRole("button", { name: "Лента отчётов" }).click();
  await expect(page.locator(".catch-post")).toHaveCount(1);
  await page.getByRole("button", { name: "Скриншот 1", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Скриншот улова" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть скриншот" }).click();
  const reports = await (await request.get("/api/reports")).json();
  expect(reports).toHaveLength(1);
  expect(reports[0].demo).toBe(false);
  expect(reports[0].totalWeightGrams).toBe(1500);
  await page.reload();
  await page.getByRole("switch").click();
  await expect(page.getByTestId("stat-posts")).toHaveText("1");
});
test("configured map is stored, renders and rejects invalid calibration", async ({
  page,
  request,
}) => {
  const invalid = await request.put("/api/maps/copper", {
    data: {
      url: "https://example.com/map.svg",
      minX: 100,
      maxX: 0,
      minY: 0,
      maxY: 100,
      flipY: true,
    },
  });
  expect(invalid.status()).toBe(400);
  await page.route("https://example.com/map.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#7a9c98"/></svg>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Настроить карту: Озеро Медное" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Настройка карты" });
  await dialog
    .getByLabel("Адрес изображения")
    .fill("https://example.com/map.svg");
  await dialog
    .getByRole("button", { name: "Сохранить карту", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('[data-water="copper"] .map-status-badge'),
  ).toHaveText("Карта пользователя");
  const maps = await (await request.get("/api/maps")).json();
  expect(maps.copper.url).toBe("https://example.com/map.svg");
  await request.delete("/api/maps/copper", { data: {} });
});
test("source limitations remain visible and unsafe API requests are rejected", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Источники", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Источники" })).toBeVisible();
  await expect(
    page.getByText("Сохранённая ссылка сама по себе не включает автосбор."),
  ).toBeVisible();
  expect(
    (
      await request.post("/api/reports", { data: { fish: "Щука", x: -1 } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/sources", {
        data: { name: "Private", url: "https://127.0.0.1/feed", type: "rss" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/reports", {
        headers: { Origin: "https://evil.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
});
test("mobile filters, map modal and water navigation fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".water-stat-card")).toHaveCount(12);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Водоём", exact: true })
    .selectOption("norwegian-sea");
  await expect(page.locator(".water-stat-card")).toHaveCount(1);
  await page.locator(".cluster-marker.red").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Точка 34");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Закрыть отчёты" }).click();
  await page.getByRole("button", { name: "Водоёмы", exact: true }).click();
  await expect(page.locator(".water-card")).toHaveCount(12);
});
