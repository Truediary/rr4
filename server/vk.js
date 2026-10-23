import { reportSchema, fetchSource } from "./importer.js";
import { waters, fish } from "./catalog.js";

export function vkDomain(value) {
  const url = new URL(value);
  if (
    !["vk.ru", "vk.com", "www.vk.ru", "www.vk.com"].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_.]+\/?$/.test(url.pathname)
  )
    throw new Error(
      "Укажите ссылку на сообщество VK, например https://vk.ru/pp4wikipedia",
    );
  return url.pathname.replaceAll("/", "");
}
function clean(text) {
  return text.replace(/\[[^|\]]+\|([^\]]+)\]/g, "$1");
}
export function vkPhotos(post) {
  const photos = [];
  for (const item of [post, ...(post.copy_history || []).slice(0, 4)])
    for (const attachment of item.attachments || []) {
      if (attachment.type !== "photo") continue;
      const sizes = (attachment.photo?.sizes || [])
        .filter(
          (size) =>
            typeof size.url === "string" && size.url.startsWith("https://"),
        )
        .sort(
          (a, b) =>
            (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0),
        );
      if (sizes[0]) photos.push(sizes[0].url);
    }
  return [...new Set(photos)].slice(0, 8);
}
export function parseVkPosts(items, domain) {
  let skipped = 0;
  const reports = items.flatMap((post) => {
    const text = clean(
      [post.text, ...(post.copy_history || []).map((item) => item.text)]
        .filter(Boolean)
        .join("\n"),
    );
    const lower = text.toLowerCase();
    const water = waters.find(
      (w) =>
        lower.includes(w.name.toLowerCase()) ||
        lower.includes(w.name.replace(/^(Озеро|Река) /, "").toLowerCase()),
    );
    const coordinates = text.match(
      /(?:^|[\s,(])(\d{1,3})\s*[:;]\s*(\d{1,3})(?=[\s,.)]|$)/,
    );
    const field = (label) =>
      text
        .match(new RegExp(`${label}\\s*[:=]\\s*([^|;\\n]+)`, "i"))?.[1]
        ?.trim();
    const bait = field("Наживка") ?? field("Насадка") ?? field("Приманка");
    const tackle =
      field("Снасть") ??
      (lower.includes("донн")
        ? "Донная"
        : lower.includes("поплав")
          ? "Поплавочная"
          : lower.includes("спиннинг")
            ? "Спиннинговая"
            : undefined);
    const fishName =
      field("Рыба") ??
      [...fish]
        .sort((a, b) => b.length - a.length)
        .find((f) => lower.includes(f.toLowerCase()));
    const parsed = reportSchema.safeParse({
      waterId: water?.id,
      fish: fishName,
      x: Number(coordinates?.[1]),
      y: Number(coordinates?.[2]),
      bait,
      tackle,
      author: `VK / ${domain}`,
      images: vkPhotos(post),
      note: text.slice(0, 2000),
      sourceUrl: `https://vk.ru/wall${post.owner_id}_${post.id}`,
      publishedAt: Number.isFinite(post.date)
        ? new Date(post.date * 1000).toISOString()
        : undefined,
    });
    if (!parsed.success) {
      skipped++;
      return [];
    }
    return [parsed.data];
  });
  return { reports, skipped };
}
export async function importVk(
  url,
  token,
  fetcher = async (address, options) => {
    const body = await fetchSource(address, 0, options);
    return { ok: true, text: async () => body };
  },
) {
  if (!token)
    throw new Error(
      "Для VK API нужен VK_ACCESS_TOKEN в настройках окружения. Не отправляйте токен в чат.",
    );
  const domain = vkDomain(url);
  const parameters = new URLSearchParams({
    domain,
    count: "100",
    filter: "owner",
    v: "5.199",
    access_token: token,
  });
  // HTTPS and a fixed official destination; no credential in URLs, logs or the database.
  const response = await fetcher("https://api.vk.com/method/wall.get", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`VK API вернул HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error("Ответ VK превышает 2 МБ");
  const data = JSON.parse(text);
  if (data.error)
    throw new Error(
      `VK API: ошибка ${data.error.error_code}. Проверьте тип токена и право чтения стены сообщества.`,
    );
  if (!Array.isArray(data.response?.items))
    throw new Error("VK API вернул неожиданный формат");
  return parseVkPosts(data.response.items, domain);
}
