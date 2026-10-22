import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicAddress,
  parseSource,
  reportSchema,
  validateSourceUrl,
} from "../server/importer.js";
import { openDatabase } from "../server/database.js";

const report = {
  waterId: "old-burg",
  fish: "Линь",
  x: 47,
  y: 20,
  bait: "Червь",
  tackle: "Донная",
  publishedAt: "2026-01-01T10:00:00.000Z",
};
test("JSON import validates reports and counts rejected entries", () => {
  const result = parseSource(
    JSON.stringify({
      reports: [
        report,
        { ...report, x: -1 },
        { ...report, waterId: "unknown" },
      ],
    }),
    "json",
    "https://example.com/reports",
  );
  assert.equal(result.reports.length, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.reports[0].sourceUrl, "https://example.com/reports");
});
test("RSS import preserves coordinates, tackle and original publication link", () => {
  const result = parseSource(
    `<rss><channel><item><title>Озеро Старый Острог 47:20</title><description>Рыба: Линь | Наживка: Червь | Снасть: Донная</description><link>https://example.com/post/12</link><pubDate>Thu, 01 Jan 2026 10:00:00 GMT</pubDate></item><item><title>Без координат</title></item></channel></rss>`,
    "rss",
    "https://example.com/feed",
  );
  assert.equal(result.reports.length, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.reports[0].x, 47);
  assert.equal(result.reports[0].y, 20);
  assert.equal(result.reports[0].fish, "Линь");
  assert.equal(result.reports[0].sourceUrl, "https://example.com/post/12");
});
test("Atom with a single entry works", () => {
  const result = parseSource(
    `<feed><entry><title>Озеро Комариное 43:29</title><summary>Рыба: Карась | Наживка: Червь | Снасть: Поплавочная</summary><link href="https://example.com/post/1"/></entry></feed>`,
    "rss",
    "https://example.com/feed",
  );
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].waterId, "mosquito");
});
test("invalid JSON structure and oversized imports fail explicitly", () => {
  assert.throws(
    () => parseSource("{}", "json", "https://example.com"),
    /массив/,
  );
  assert.throws(
    () =>
      parseSource(
        JSON.stringify(Array(501).fill(report)),
        "json",
        "https://example.com",
      ),
    /500/,
  );
});
test("reject future reports, negative coordinates, and script links", () => {
  assert.equal(
    reportSchema.safeParse({ ...report, publishedAt: "2099-01-01T00:00:00Z" })
      .success,
    false,
  );
  assert.equal(reportSchema.safeParse({ ...report, x: -1 }).success, false);
  assert.equal(
    reportSchema.safeParse({ ...report, sourceUrl: "javascript:alert(1)" })
      .success,
    false,
  );
});
test("SSRF protection blocks internal IPv4 and IPv6 including mapped addresses", async () => {
  for (const value of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPublicAddress(value), false, value);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  await assert.rejects(
    validateSourceUrl("https://127.0.0.1/test"),
    /Внутренние/,
  );
  await assert.rejects(validateSourceUrl("http://example.com"), /HTTPS/);
  await assert.rejects(
    validateSourceUrl("https://user:password@example.com"),
    /пароля/,
  );
});
test("database deduplicates source reports, preserving different fish and dates", () => {
  const store = openDatabase(":memory:");
  const first = store.addReport(report, "Test source", "source-1");
  assert.ok(first);
  assert.equal(store.addReport(report, "Test source", "source-1"), null);
  assert.ok(
    store.addReport({ ...report, fish: "Лещ" }, "Test source", "source-1"),
  );
  assert.ok(
    store.addReport(
      { ...report, publishedAt: "2026-01-02T10:00:00.000Z" },
      "Test source",
      "source-1",
    ),
  );
  assert.equal(store.reports().length, 3);
  assert.equal(store.reports()[0].publishedAt, "2026-01-02T10:00:00.000Z");
  assert.equal(store.reports()[0].demo, false);
  assert.equal(store.reports()[0].sourceName, "Test source");
  store.db.close();
});
test("proxy mode requires an administrator-approved exact hostname", async () => {
  const previousProxy = process.env.HTTPS_PROXY;
  const previousHosts = process.env.FEED_ALLOWED_HOSTS;
  try {
    process.env.HTTPS_PROXY = "http://proxy.example:8080";
    process.env.FEED_ALLOWED_HOSTS = "feed.example.com";
    await assert.rejects(
      validateSourceUrl("https://unapproved.example.com/feed"),
      /FEED_ALLOWED_HOSTS/,
    );
    await assert.rejects(
      validateSourceUrl("https://localhost/feed"),
      /Внутренние/,
    );
    await assert.rejects(
      validateSourceUrl("https://feed.example.com.attacker.test/feed"),
      /FEED_ALLOWED_HOSTS/,
    );
    const validated = await validateSourceUrl("https://feed.example.com/feed");
    assert.equal(validated.url.hostname, "feed.example.com");
    assert.ok(validated.proxy);
  } finally {
    if (previousProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = previousProxy;
    if (previousHosts === undefined) delete process.env.FEED_ALLOWED_HOSTS;
    else process.env.FEED_ALLOWED_HOSTS = previousHosts;
  }
});
