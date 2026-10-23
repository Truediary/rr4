import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { bundledMapMedia, bundledMaps, resolveMaps } from "../server/bundled-maps.js";
import { waters } from "../server/catalog.js";

test("all supplied maps match their archive hashes and catalog waters", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/maps/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.files.length, 16);
  assert.equal(new Set(manifest.files.map((file) => file.waterId)).size, 16);
  assert.equal(bundledMapMedia.length, 16);
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../public/maps/${file.fileName}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
    assert.equal(bytes.length, file.size);
    assert.equal(bytes.readUInt32BE(16), file.width);
    assert.equal(bytes.readUInt32BE(20), file.height);
    assert.equal(waters.find((water) => water.id === file.waterId)?.name, file.waterName);
    assert.equal(bundledMaps[file.waterId].calibrated, false);
    assert.equal(bundledMaps[file.waterId].minX, undefined);
  }
});

test("bundled map defaults preserve custom calibration and persistent disabling", () => {
  const custom = { url: "https://example.com/custom.png", minX: 10, maxX: 200, minY: 20, maxY: 300, flipY: true };
  const overrides = { amber: custom, mosquito: null };
  const resolved = resolveMaps(overrides);
  assert.deepEqual(resolved.amber, custom);
  assert.equal(resolved.mosquito, undefined);
  assert.deepEqual(resolved.ladoga, bundledMaps.ladoga);
  assert.equal(overrides.mosquito, null);
  assert.equal(bundledMaps.amber.calibrated, false);
  assert.equal(resolveMaps().mosquito.url, "/maps/mosquito.png");
});
