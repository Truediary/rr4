import test from "node:test";
import assert from "node:assert/strict";
import {
  chartBuckets,
  filterReports,
  groupReports,
  pointKey,
  summarize,
  weightInGrams,
} from "../shared/statistics.js";
import { reportSchema } from "../server/importer.js";
const now = Date.parse("2026-10-22T12:00:00Z");
const base = {
  id: "a",
  waterId: "old-burg",
  fish: "Линь",
  x: 47,
  y: 20,
  bait: "Червь",
  tackle: "Донная",
  weight: "1 кг",
  catches: 2,
  publishedAt: "2026-10-22T11:00:00Z",
  author: "Рыболов",
  note: "",
  quality: "trophy",
  clip: "25",
  totalWeightGrams: 1500,
  silver: 100,
  durationMinutes: 30,
  temperatureC: 10,
};
test("statistics use total measured weight and time-weighted session income", () => {
  const reports = [
    base,
    {
      ...base,
      id: "b",
      catches: 1,
      weight: "2 кг",
      totalWeightGrams: undefined,
      silver: 100,
      durationMinutes: 90,
      temperatureC: 20,
    },
    {
      ...base,
      id: "c",
      catches: 4,
      weight: "3 кг",
      totalWeightGrams: undefined,
      silver: undefined,
      durationMinutes: undefined,
      temperatureC: undefined,
    },
  ];
  const result = summarize(reports);
  assert.equal(result.posts, 3);
  assert.equal(result.catches, 7);
  assert.equal(result.maxWeight, 3000);
  assert.equal(result.averageWeight, 750);
  assert.equal(result.weightCoverage, 1);
  assert.equal(result.farm, 100);
  assert.equal(result.farmCoverage, 2);
  assert.equal(result.temperature, 15);
});
test("missing measurements stay unknown; real zero values stay zero", () => {
  const unknown = summarize([
    {
      ...base,
      totalWeightGrams: undefined,
      weight: "",
      silver: undefined,
      durationMinutes: undefined,
      temperatureC: undefined,
    },
  ]);
  assert.equal(unknown.maxWeight, null);
  assert.equal(unknown.averageWeight, null);
  assert.equal(unknown.farm, null);
  assert.equal(unknown.temperature, null);
  const zero = summarize([
    { ...base, totalWeightGrams: 0, silver: 0, temperatureC: 0 },
  ]);
  assert.equal(zero.averageWeight, 0);
  assert.equal(zero.farm, 0);
  assert.equal(zero.temperature, 0);
  assert.equal(summarize([]).posts, 0);
  assert.equal(summarize([]).maxWeight, null);
});
test("legacy weights parse comma decimals, spaced grams and kilograms", () => {
  assert.equal(weightInGrams("4,8 кг"), 4800);
  assert.equal(weightInGrams("2 122 929 г"), 2122929);
  assert.equal(weightInGrams("609 г"), 609);
  assert.equal(weightInGrams("unknown"), null);
  assert.equal(weightInGrams("-3 кг"), null);
});
test("same coordinates on different waters never merge", () => {
  const groups = groupReports(
    [base, { ...base, id: "b" }, { ...base, id: "c", waterId: "copper" }],
    "point",
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].posts, 2);
  assert.equal(groups[0].catches, 4);
  assert.equal(groups[0].key, "old-burg|47:20");
});
test("filters combine period, fish, bait, point, quality, clip and hourly farm", () => {
  const filters = {
    waterId: "old-burg",
    fish: "Линь",
    bait: "Червь",
    point: pointKey(base),
    quality: "trophy",
    clip: "25",
    hours: 6,
    minFarm: 150,
  };
  assert.equal(
    filterReports(
      [
        base,
        { ...base, id: "other-water", waterId: "copper" },
        { ...base, id: "old", publishedAt: "2026-10-20T00:00:00Z" },
        { ...base, id: "clip", clip: "20" },
        { ...base, id: "missing-income", silver: undefined },
      ],
      filters,
      now,
    ).length,
    1,
  );
  assert.equal(
    filterReports([base], { ...filters, minFarm: 201 }, now).length,
    0,
  );
});
test("chart includes both window boundaries and omits outside reports", () => {
  const buckets = chartBuckets(
    [
      { ...base, publishedAt: new Date(now - 24 * 3600000).toISOString() },
      { ...base, publishedAt: new Date(now).toISOString() },
      { ...base, publishedAt: new Date(now + 1).toISOString() },
      { ...base, publishedAt: new Date(now - 24 * 3600000 - 1).toISOString() },
    ],
    24,
    now,
  );
  assert.equal(buckets[0].posts, 1);
  assert.equal(buckets[11].posts, 1);
  assert.equal(
    buckets.reduce((s, b) => s + b.catches, 0),
    4,
  );
});
test("extended report measurements survive validation and reject invalid inputs", () => {
  const parsed = reportSchema.parse({
    ...base,
    publishedAt: "2026-01-01T00:00:00Z",
    images: ["https://example.com/catch.jpg"],
  });
  assert.equal(parsed.clip, "25");
  assert.equal(parsed.totalWeightGrams, 1500);
  assert.equal(parsed.images.length, 1);
  assert.equal(
    reportSchema.safeParse({ ...base, durationMinutes: 0 }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...base, totalWeightGrams: -1 }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...base, images: ["javascript:alert(1)"] })
      .success,
    false,
  );
});
