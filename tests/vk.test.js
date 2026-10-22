import test from "node:test";
import assert from "node:assert/strict";
import { vkDomain, parseVkPosts, importVk } from "../server/vk.js";
const post = {
  id: 100,
  owner_id: -123,
  date: 1760000000,
  text: "Озеро Старый Острог 47:20\nРыба: Линь\nНаживка: Червь\nСнасть: Донная",
};
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
