import express from "express";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { openDatabase } from "./database.js";
import { waters, fish, demoReports } from "./catalog.js";
import {
  reportSchema,
  validateSourceUrl,
  fetchSource,
  parseSource,
} from "./importer.js";
import { importVk, vkDomain } from "./vk.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR ?? resolve(root, "data");
mkdirSync(dataDir, { recursive: true });
const store = openDatabase(resolve(dataDir, "klev.sqlite"));
// Requested sources are registered as candidates; no imported data is fabricated.
if (!store.getSetting("sourcesInitialized")) {
  const rf4 = store.addSource({
    name: "RF4 STAT",
    url: "https://www.rf4-stat.ru/",
    type: "website",
  });
  store.markSource(rf4, "Автосбор не подключён: нужен API или адаптер сайта");
  const vk = store.addSource({
    name: "РР4 Википедия",
    url: "https://vk.ru/pp4wikipedia",
    type: "vk",
  });
  store.markSource(
    vk,
    process.env.VK_ACCESS_TOKEN
      ? "VK API: готов к проверке доступа"
      : "VK API: нужен VK_ACCESS_TOKEN в настройках окружения",
  );
  store.setSetting("sourcesInitialized", "true");
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && new URL(origin).host !== req.get("host"))
      return res.status(403).json({ error: "Запрос с другого сайта запрещён" });
    if (!req.is("application/json"))
      return res.status(415).json({ error: "Требуется application/json" });
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", database: "sqlite" }),
);
app.get("/api/catalog", (_req, res) => res.json({ waters, fish }));
app.get("/api/maps", (_req, res) =>
  res.json(JSON.parse(store.getSetting("waterMaps") || "{}")),
);
const mapSchema = z
  .object({
    url: z
      .string()
      .max(2000)
      .refine((value) => {
        if (/^\/maps\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes(".."))
          return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    minX: z.number().finite(),
    maxX: z.number().finite(),
    minY: z.number().finite(),
    maxY: z.number().finite(),
    flipY: z.boolean(),
  })
  .refine(
    (v) => v.maxX > v.minX && v.maxY > v.minY,
    "Максимальные координаты должны быть больше минимальных",
  );
app.put("/api/maps/:waterId", (req, res) => {
  if (!waters.some((w) => w.id === req.params.waterId))
    return res.status(404).json({ error: "Водоём не найден" });
  const config = mapSchema.parse(req.body);
  const maps = JSON.parse(store.getSetting("waterMaps") || "{}");
  maps[req.params.waterId] = config;
  store.setSetting("waterMaps", JSON.stringify(maps));
  res.json(config);
});
app.delete("/api/maps/:waterId", (req, res) => {
  const maps = JSON.parse(store.getSetting("waterMaps") || "{}");
  delete maps[req.params.waterId];
  store.setSetting("waterMaps", JSON.stringify(maps));
  res.json({ ok: true });
});
app.get("/api/reports", (req, res) =>
  res.json(req.query.demo === "true" ? demoReports() : store.reports()),
);
app.post("/api/reports", (req, res) => {
  const report = reportSchema.parse(req.body);
  const saved = store.addReport(report);
  if (!saved)
    return res
      .status(409)
      .json({ error: "Похожий отчёт на эту дату уже добавлен" });
  res.status(201).json(saved);
});
app.get("/api/sources", (_req, res) => res.json(store.sources()));
app.post("/api/sources", async (req, res) => {
  const source = z
    .object({
      name: z.string().trim().min(2).max(80),
      url: z.url().max(2000),
      type: z.enum(["rss", "json", "website", "vk"]),
    })
    .parse(req.body);
  await validateSourceUrl(source.url);
  if (source.type === "vk") vkDomain(source.url);
  try {
    const id = store.addSource(source);
    if (source.type === "website")
      store.markSource(
        id,
        "Автосбор не подключён: нужен API или адаптер сайта",
      );
    if (source.type === "vk")
      store.markSource(
        id,
        process.env.VK_ACCESS_TOKEN
          ? "VK API: готов к проверке доступа"
          : "VK API: нужен VK_ACCESS_TOKEN в настройках окружения",
      );
    res.status(201).json({ id });
  } catch (error) {
    if (error.code?.startsWith("ERR_SQLITE"))
      return res.status(409).json({ error: "Этот источник уже добавлен" });
    throw error;
  }
});
const syncing = new Set();
async function syncOne(source) {
  if (syncing.has(source.id)) throw new Error("Этот источник уже обновляется");
  syncing.add(source.id);
  try {
    const { reports, skipped } =
      source.type === "vk"
        ? await importVk(source.url, process.env.VK_ACCESS_TOKEN)
        : parseSource(await fetchSource(source.url), source.type, source.url);
    let imported = 0;
    for (const report of reports)
      if (store.addReport(report, source.name, source.id)) imported++;
    const duplicates = reports.length - imported;
    store.markSource(
      source.id,
      `Добавлено: ${imported}; дубликатов: ${duplicates}; пропущено: ${skipped}`,
    );
    return { imported, skipped, duplicates };
  } catch (error) {
    store.markSource(source.id, `Ошибка: ${error.message}`);
    throw error;
  } finally {
    syncing.delete(source.id);
  }
}
app.post("/api/sources/:id/sync", async (req, res) => {
  const source = store.sources().find((s) => s.id === req.params.id);
  if (!source) return res.status(404).json({ error: "Источник не найден" });
  if (source.type === "website")
    return res.status(422).json({
      error:
        "Для этого сайта пока нет адаптера. Можно добавить отчёт со ссылкой на публикацию или подключить RSS/JSON-ленту.",
    });
  if (syncing.has(source.id))
    return res.status(409).json({ error: "Этот источник уже обновляется" });
  try {
    res.json(await syncOne(source));
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});
let cycleRunning = false;
async function syncCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    for (const source of store.sources()) {
      if (
        source.type === "website" ||
        syncing.has(source.id) ||
        (source.type === "vk" && !process.env.VK_ACCESS_TOKEN)
      )
        continue;
      try {
        await syncOne(source);
      } catch {
        /* Source status contains the failure; keep other feeds running. */
      }
    }
  } finally {
    cycleRunning = false;
  }
}
setInterval(syncCycle, 30 * 60 * 1000).unref();
setTimeout(syncCycle, 5000).unref();
app.delete("/api/sources/:id", (req, res) => {
  if (!store.deleteSource(req.params.id))
    return res.status(404).json({ error: "Источник не найден" });
  res.json({ ok: true });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Метод API не найден" }),
);
app.use(express.static(resolve(root, "dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(resolve(root, "dist/index.html")),
);
app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError)
    return res.status(400).json({
      error: "Проверьте поля формы",
      details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Некорректный JSON" });
  console.error(error.message);
  res
    .status(400)
    .json({ error: error.message ?? "Не удалось выполнить запрос" });
});
const port = Number(process.env.PORT ?? 3001);
app.listen(port, "0.0.0.0", () =>
  console.log(`Клёв: сервер запущен на порту ${port}`),
);
