import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  bundledMapMedia,
  bundledMaps,
  resolveMaps,
} from "../server/bundled-maps.js";
import { waters } from "../server/catalog.js";
import {
  calibrateFromPoints,
  containImage,
  gameToMap,
  mapToGame,
  pointFromClient,
} from "../shared/maps.js";

test("all supplied maps match their archive hashes and catalog waters", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../public/maps/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.files.length, 16);
  assert.equal(new Set(manifest.files.map((file) => file.waterId)).size, 16);
  assert.equal(bundledMapMedia.length, 16);
  for (const file of manifest.files) {
    const bytes = readFileSync(
      new URL(`../public/maps/${file.fileName}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
    assert.equal(bytes.length, file.size);
    assert.equal(bytes.readUInt32BE(16), file.width);
    assert.equal(bytes.readUInt32BE(20), file.height);
    assert.equal(
      waters.find((water) => water.id === file.waterId)?.name,
      file.waterName,
    );
    assert.equal(
      bundledMaps[file.waterId].calibrated,
      file.waterId !== "norwegian-sea",
    );
    if (file.waterId !== "norwegian-sea")
      assert.match(
        bundledMaps[file.waterId].coordinateSource.url,
        /^https:\/\/rf4map\.ru\/location\/\d+$/,
      );
  }
});

test("bundled map defaults preserve custom calibration and persistent disabling", () => {
  const custom = {
    url: "https://example.com/custom.png",
    minX: 10,
    maxX: 200,
    minY: 20,
    maxY: 300,
    flipY: true,
  };
  const overrides = { amber: custom, mosquito: null };
  const resolved = resolveMaps(overrides);
  assert.deepEqual(resolved.amber, custom);
  assert.equal(resolved.mosquito, undefined);
  assert.deepEqual(resolved.ladoga, bundledMaps.ladoga);
  assert.equal(overrides.mosquito, null);
  assert.equal(bundledMaps.amber.calibrated, true);
  assert.equal(resolveMaps().mosquito.url, "/maps/mosquito.png");
});

const oldBurg = {
  url: "/maps/old-burg.png",
  minX: 0,
  maxX: 80,
  minY: 2,
  maxY: 80,
  flipY: true,
};
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("game coordinates project against the full image and return without rounding drift", () => {
  const point = gameToMap({ x: 47, y: 20 }, oldBurg);
  near(point.u, 0.5875);
  near(point.v, 60 / 78);
  const restored = mapToGame(point, oldBurg);
  near(restored.x, 47);
  near(restored.y, 20);
  assert.deepEqual(gameToMap({ x: 0, y: 80 }, oldBurg), { u: 0, v: 0 });
  assert.deepEqual(gameToMap({ x: 80, y: 2 }, oldBurg), { u: 1, v: 1 });
  assert.equal(gameToMap({ x: 81, y: 20 }, oldBurg), null);
  assert.equal(gameToMap({ x: NaN, y: 20 }, oldBurg), null);
  assert.equal(mapToGame({ u: 1.1, v: 0 }, oldBurg), null);
  assert.equal(gameToMap({ x: 1, y: 1 }, bundledMaps["norwegian-sea"]), null);
});

test("letterboxing, zoom and translation preserve the same game coordinate", () => {
  assert.deepEqual(containImage(400, 300, 800, 800), {
    left: 50,
    top: 0,
    width: 300,
    height: 300,
  });
  assert.deepEqual(containImage(300, 400, 800, 400), {
    left: 0,
    top: 125,
    width: 300,
    height: 150,
  });
  const point = pointFromClient(
    50 + 300 * 0.5875,
    (300 * 60) / 78,
    { left: 50, top: 0, width: 300, height: 300 },
    oldBurg,
  );
  near(point.x, 47);
  near(point.y, 20);
  const zoomed = pointFromClient(
    -100 + 900 * 0.5875,
    25 + (900 * 60) / 78,
    { left: -100, top: 25, width: 900, height: 900 },
    oldBurg,
  );
  near(zoomed.x, 47);
  near(zoomed.y, 20);
  assert.equal(
    pointFromClient(
      25,
      150,
      { left: 50, top: 0, width: 300, height: 300 },
      oldBurg,
    ),
    null,
  );
  assert.equal(
    pointFromClient(0, 0, { left: 0, top: 0, width: 0, height: 0 }, oldBurg),
    null,
  );
});

test("two control points solve image-frame offsets and either vertical direction", () => {
  const first = { u: 0.1, v: 0.2, x: 20, y: 140 },
    second = { u: 0.9, v: 0.8, x: 180, y: 20 };
  const fitted = calibrateFromPoints(first, second);
  near(fitted.minX, 0);
  near(fitted.maxX, 200);
  near(fitted.minY, -20);
  near(fitted.maxY, 180);
  assert.equal(fitted.flipY, true);
  for (const anchor of [first, second]) {
    const projected = gameToMap(anchor, fitted);
    near(projected.u, anchor.u);
    near(projected.v, anchor.v);
  }
  const downward = calibrateFromPoints(
    { ...first, y: 20 },
    { ...second, y: 140 },
  );
  assert.equal(downward.flipY, false);
  near(mapToGame({ u: 0.5, v: 0.5 }, downward).y, 80);
  assert.throws(
    () => calibrateFromPoints(first, { ...second, u: 0.11 }),
    /подальше/,
  );
  assert.throws(
    () => calibrateFromPoints(first, { ...second, x: 10 }),
    /вправо/,
  );
  assert.throws(
    () => calibrateFromPoints(first, { ...second, y: NaN }),
    /две точки/,
  );
});
