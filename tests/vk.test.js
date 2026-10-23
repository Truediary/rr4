import test from "node:test";
import assert from "node:assert/strict";
import { vkDomain, parseVkPosts, importVk, vkPhotos } from "../server/vk.js";
const post = {
  id: 100,
  owner_id: -123,
  date: 1760000000,
  text: "Озеро Старый Острог 47:20\nРыба: Линь\nНаживка: Червь\nСнасть: Донная",
};
test("VK imports original photo attachments at the largest size, including reposts", () => {
  const photo = {
    type: "photo",
    photo: {
      sizes: [
        { url: "https://example.com/small.jpg", width: 100, height: 80 },
        { url: "https://example.com/large.jpg", width: 1600, height: 1200 },
      ],
    },
  };
  const original = {
    ...post,
    attachments: [photo],
    copy_history: [
      {
        text: "Дополнение к отчёту",
        attachments: [
          photo,
          {
            type: "photo",
            photo: {
              sizes: [
                {
                  url: "https://example.com/second.jpg",
                  width: 800,
                  height: 600,
                },
              ],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(vkPhotos(original), [
    "https://example.com/large.jpg",
    "https://example.com/second.jpg",
  ]);
  const parsed = parseVkPosts([original], "pp4wikipedia");
  assert.equal(parsed.reports[0].images.length, 2);
  assert.match(parsed.reports[0].note, /Дополнение/);
});
test("VK parser requires enough evidence and preserves publication provenance", () => {
  const result = parseVkPosts(
    [post, { ...post, id: 101, text: "Просто фото рыбалки" }],
    "pp4wikipedia",
  );
  assert.equal(result.reports.length, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.reports[0].sourceUrl, "https://vk.ru/wall-123_100");
  assert.equal(result.reports[0].x, 47);
});
test("VK destination is fixed and token is sent only in a POST body", async () => {
  const result = await importVk(
    "https://vk.ru/pp4wikipedia",
    "test-token",
    async (url, options) => {
      assert.equal(url, "https://api.vk.com/method/wall.get");
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("access_token"), "test-token");
      assert.equal(options.body.get("domain"), "pp4wikipedia");
      return {
        ok: true,
        text: async () => JSON.stringify({ response: { items: [post] } }),
      };
    },
  );
  assert.equal(result.reports.length, 1);
});
test("VK rejects missing credentials, invalid domains and API errors without leaking tokens", async () => {
  await assert.rejects(
    importVk("https://vk.ru/pp4wikipedia", undefined),
    /VK_ACCESS_TOKEN/,
  );
  assert.throws(
    () => vkDomain("https://example.com/pp4wikipedia"),
    /сообщество/,
  );
  await assert.rejects(
    importVk("https://vk.ru/pp4wikipedia", "never-print-this", async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          error: { error_code: 5, error_msg: "sensitive error" },
        }),
    })),
    /^Error: VK API: ошибка 5/,
  );
});
