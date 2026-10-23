import dns from "node:dns/promises";
import net from "node:net";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { waters } from "./catalog.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { isImageReference } from "../shared/media.js";

const proxyAddress = () => process.env.HTTPS_PROXY || process.env.https_proxy;
function proxyAllowedHosts() {
  return new Set([
    "rf4-stat.ru",
    "www.rf4-stat.ru",
    "vk.ru",
    "www.vk.ru",
    "api.vk.com",
    "rf4map.ru",
    "www.rf4map.ru",
    ...(process.env.FEED_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ]);
}

export const reportSchema = z.object({
  waterId: z.enum(waters.map((w) => w.id)),
  fish: z.string().trim().min(2).max(80),
  x: z.number().int().min(0).max(999),
  y: z.number().int().min(0).max(999),
  bait: z.string().trim().min(2).max(120),
  tackle: z.enum(["Донная", "Поплавочная", "Спиннинговая"]),
  weight: z.string().trim().max(40).default(""),
  catches: z.number().int().min(1).max(10000).default(1),
  author: z.string().trim().min(2).max(80).default("Рыболов"),
  note: z.string().trim().max(2000).default(""),
  pointLabel: z.string().trim().min(1).max(30).optional(),
  clip: z.string().trim().max(30).optional(),
  quality: z.enum(["normal", "trophy", "rare", "record"]).optional(),
  maxWeightGrams: z.number().nonnegative().max(100000000).optional(),
  totalWeightGrams: z.number().nonnegative().max(10000000000).optional(),
  silver: z.number().nonnegative().max(1000000000).optional(),
  durationMinutes: z.number().positive().max(100000).optional(),
  temperatureC: z.number().min(-80).max(80).optional(),
  depthM: z.number().nonnegative().max(1000).optional(),
  images: z
    .array(
      z
        .string()
        .refine(
          isImageReference,
          "Нужна HTTPS-ссылка или загруженное изображение",
        ),
    )
    .max(8)
    .optional(),
  sourceUrl: z
    .url()
    .max(2000)
    .refine((v) => /^https?:\/\//.test(v))
    .refine((v) => {
      const url = new URL(v);
      return !url.username && !url.password;
    })
    .nullable()
    .default(null),
  publishedAt: z.iso
    .datetime()
    .refine(
      (v) => Date.parse(v) <= Date.now() + 300000,
      "Дата отчёта не может быть в будущем",
    )
    .optional(),
});

// Validate every destination and pin DNS resolution in the HTTPS connection.
export function isPublicAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && [18, 19].includes(b))
    );
  }
  // Only global unicast IPv6; disallow mapped IPv4, NAT64, documentation and private ranges.
  return (
    net.isIPv6(address) &&
    /^[23]/i.test(address) &&
    !address.toLowerCase().startsWith("2001:db8:")
  );
}
export async function validateSourceUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Нужен публичный HTTPS-адрес без пароля и нестандартного порта",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host))
    throw new Error("Внутренние и служебные адреса недоступны для импорта");
  if (net.isIP(host) && !isPublicAddress(host))
    throw new Error("Внутренние и служебные адреса недоступны для импорта");
  if (proxyAddress()) {
    // The managed proxy resolves DNS remotely. Only administrator-approved exact
    // hostnames are usable here; arbitrary user-supplied hosts remain denied.
    if (!proxyAllowedHosts().has(host))
      throw new Error(
        `Для загрузки через прокси добавьте публичный домен ${host} в FEED_ALLOWED_HOSTS и сетевые настройки окружения`,
      );
    return { url, addresses: [], proxy: proxyAddress() };
  }
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Внутренние и служебные адреса недоступны для импорта");
  return { url, addresses };
}
export async function fetchSource(value, redirects = 0, requestOptions = {}) {
  const { url, addresses, proxy } = await validateSourceUrl(value);
  const https = await import("node:https");
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: requestOptions.method || "GET",
        signal: AbortSignal.timeout(15000),
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        headers: {
          "User-Agent": "Klev-RF4/0.1 (+public-feed-reader)",
          Accept:
            "application/json, application/rss+xml, application/atom+xml, text/xml",
          ...requestOptions.headers,
        },
        lookup: proxy
          ? undefined
          : (_host, options, cb) => {
              if (options.all) cb(null, addresses);
              else cb(null, addresses[0].address, addresses[0].family);
            },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          if (requestOptions.method && requestOptions.method !== "GET")
            return reject(new Error("Перенаправление API-запроса запрещено"));
          if (redirects >= 3 || !res.headers.location)
            return reject(new Error("Слишком много перенаправлений"));
          fetchSource(
            new URL(res.headers.location, url).href,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Источник вернул HTTP ${res.statusCode}`));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024)
            req.destroy(new Error("Размер источника превышает 2 МБ"));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.setTimeout(15000, () =>
      req.destroy(new Error("Источник не ответил за 15 секунд")),
    );
    req.on("error", reject);
    req.end(requestOptions.body?.toString());
  });
}
function plain(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseSource(body, type, sourceUrl) {
  let entries;
  if (type === "json") {
    const parsed = JSON.parse(body);
    entries = Array.isArray(parsed) ? parsed : parsed.reports;
    if (!Array.isArray(entries))
      throw new Error("JSON должен содержать массив отчётов или поле reports");
  } else {
    const xml = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
    }).parse(body);
    const items = xml.rss?.channel?.item ?? xml.feed?.entry;
    entries = items ? (Array.isArray(items) ? items : [items]) : [];
    entries = entries.map((item) => {
      const title = plain(item.title?.["#text"] ?? item.title);
      const text = plain(
        item.description ?? item.summary ?? item.content ?? "",
      );
      const combined = `${title} ${text}`;
      const water = waters.find(
        (w) =>
          combined.toLowerCase().includes(w.name.toLowerCase()) ||
          combined
            .toLowerCase()
            .includes(w.name.replace(/^(Озеро|Река) /, "").toLowerCase()),
      );
      const coordinate = combined.match(
        /(?:^|\s)(\d{1,3})\s*[:;]\s*(\d{1,3})(?=\s|[.,]|$)/,
      );
      const field = (label) =>
        combined
          .match(new RegExp(`${label}\\s*[:=]\\s*([^|;\\n]+)`, "i"))?.[1]
          ?.trim();
      let link =
        typeof item.link === "string" ? item.link : item.link?.["@_href"];
      try {
        link = new URL(link, sourceUrl).href;
      } catch {
        link = sourceUrl;
      }
      const date = item.pubDate ?? item.published ?? item.updated;
      return {
        waterId: water?.id,
        x: Number(coordinate?.[1]),
        y: Number(coordinate?.[2]),
        fish: field("Рыба"),
        bait: field("Наживка"),
        tackle: field("Снасть"),
        note: combined.slice(0, 2000),
        author: "Открытый источник",
        sourceUrl: link,
        publishedAt:
          date && Number.isFinite(Date.parse(date))
            ? new Date(date).toISOString()
            : undefined,
      };
    });
  }
  if (entries.length > 500)
    throw new Error("Не более 500 записей за один импорт");
  let skipped = 0;
  const reports = entries.flatMap((entry) => {
    const parsed = reportSchema.safeParse({
      ...entry,
      sourceUrl: entry.sourceUrl ?? sourceUrl,
    });
    if (!parsed.success) {
      skipped++;
      return [];
    }
    return [parsed.data];
  });
  return { reports, skipped };
}
