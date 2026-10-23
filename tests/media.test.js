import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/database.js";
import { saveImage } from "../server/media.js";
import { isImageReference } from "../shared/media.js";
import { reportSchema } from "../server/importer.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kYz8AAAAASUVORK5CYII=",
  "base64",
);
test("bundled original screenshots match the recorded checksums", () => {
  const root = new URL("../public/game-assets/", import.meta.url);
  const manifest = JSON.parse(
    readFileSync(new URL("provenance.json", root), "utf8"),
  );
  for (const [name, entry] of Object.entries(manifest)) {
    const bytes = readFileSync(new URL(name, root));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
    );
    assert.match(entry.source, /612f501b3edc5a6c85feafd5a3985c1823021894/);
  }
});
test("uploaded image bytes and provenance persist without trusting the filename", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rr4-media-"));
  const store = openDatabase(":memory:");
  try {
    const asset = await saveImage(
      { originalname: "../../fake.exe", buffer: png, size: png.length },
      { kind: "fish", entity: "Линь", sourceUrl: "https://example.com/post/7" },
      directory,
      store,
    );
    assert.match(asset.url, /^\/media\/[a-f0-9-]+\.png$/);
    assert.equal(asset.mime, "image/png");
    assert.equal(asset.origin, "user-upload");
    assert.equal(asset.sourceUrl, "https://example.com/post/7");
    assert.deepEqual(
      await readFile(join(directory, asset.url.split("/").pop())),
      png,
    );
    assert.equal(store.media()[0].entity, "Линь");
    assert.equal((await readdir(directory)).length, 1);
  } finally {
    store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("HTML and SVG uploads are rejected and do not create files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rr4-media-"));
  const store = openDatabase(":memory:");
  try {
    await assert.rejects(
      saveImage(
        {
          originalname: "photo.png",
          buffer: Buffer.from("<html><script>alert(1)</script></html>"),
          size: 40,
        },
        {},
        directory,
        store,
      ),
      /PNG/,
    );
    assert.equal(store.media().length, 0);
    assert.equal((await readdir(directory)).length, 0);
  } finally {
    store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("local image references exclude traversal, HTML, foreign paths and credential URLs", () => {
  assert.equal(
    isImageReference("/media/00000000-1111-2222-3333-444444444444.png"),
    true,
  );
  assert.equal(isImageReference("https://example.com/catch.jpg"), true);
  for (const value of [
    "/media/../secret.png",
    "/media/test.html",
    "/api/reports",
    "javascript:alert(1)",
    "https://user:secret@example.com/catch.png",
  ])
    assert.equal(isImageReference(value), false, value);
  const report = reportSchema.safeParse({
    waterId: "old-burg",
    fish: "Линь",
    x: 47,
    y: 20,
    bait: "Червь",
    tackle: "Донная",
    images: ["/media/00000000-1111-2222-3333-444444444444.png"],
  });
  assert.equal(report.success, true);
});
