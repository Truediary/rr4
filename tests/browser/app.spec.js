import { test, expect } from "@playwright/test";
test("catalog, filters, favorites and coordinate map work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Точки клёва" }),
  ).toBeVisible();
  await expect(page.locator(".report-card")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "Рыба", exact: true })
    .selectOption("Линь");
  await expect(page.locator(".report-card")).toHaveCount(1);
  await expect(page.locator(".coordinates")).toHaveText("47:20");
  await page.getByRole("button", { name: "В избранное: Линь" }).click();
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
  await page.locator(".report-footer button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Вымышленная точка");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("real report is persisted through API, form and reload", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить точку", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Рыба", { exact: true }).fill("Тестовый линь");
  await dialog.getByLabel("Координата X").fill("47");
  await dialog.getByLabel("Координата Y").fill("20");
  await dialog.getByLabel("Наживка", { exact: true }).fill("Тестовое тесто");
  await dialog.getByLabel("Ваш ник").fill(`Рыболов ${Date.now()}`);
  await dialog.getByRole("button", { name: "Опубликовать отчёт" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".report-card").filter({ hasText: "Тестовый линь" }),
  ).toHaveCount(1);
  await expect(page.getByRole("switch")).not.toBeChecked();
  const reports = await (await request.get("/api/reports")).json();
  expect(
    reports.some((r) => r.fish === "Тестовый линь" && r.demo === false),
  ).toBe(true);
  await page.reload();
  await page.getByRole("switch").click();
  await expect(
    page.locator(".report-card").filter({ hasText: "Тестовый линь" }),
  ).toHaveCount(1);
});
test("sources distinguish websites from feeds; API rejects invalid reports and internal URLs", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Источники", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Источники" })).toBeVisible();
  await expect(
    page.getByText("Сохранённая ссылка сама по себе не включает автосбор."),
  ).toBeVisible();
  const invalid = await request.post("/api/reports", {
    data: { fish: "Щука", x: -1 },
  });
  expect(invalid.status()).toBe(400);
  const privateUrl = await request.post("/api/sources", {
    data: { name: "Private", url: "https://127.0.0.1/feed", type: "rss" },
  });
  expect(privateUrl.status()).toBe(400);
  const crossOrigin = await request.post("/api/reports", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
});
test("mobile fits viewport and navigation opens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".report-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("button", { name: "Водоёмы", exact: true }).click();
  await expect(page.locator(".water-card")).toHaveCount(10);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
