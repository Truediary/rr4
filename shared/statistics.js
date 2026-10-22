export function pointKey(report) {
  return `${report.waterId}|${report.x}:${report.y}`;
}
export function pointLabel(report) {
  return report.pointLabel || `${report.x}:${report.y}`;
}
export function weightInGrams(value) {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? value : null;
  if (!value) return null;
  const match = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .match(/^(\d+(?:\.\d+)?)(кг|kg|г|g)?$/i);
  return match
    ? Number(match[1]) * (/^(кг|kg)$/i.test(match[2] || "") ? 1000 : 1)
    : null;
}
export function filterReports(reports, filters, now = Date.now()) {
  return reports.filter(
    (r) =>
      (!filters.waterId || r.waterId === filters.waterId) &&
      (!filters.fish || r.fish === filters.fish) &&
      (!filters.bait || r.bait === filters.bait) &&
      (!filters.point || pointKey(r) === filters.point) &&
      (!filters.tackle || r.tackle === filters.tackle) &&
      (!filters.quality || r.quality === filters.quality) &&
      (!filters.clip || r.clip === filters.clip) &&
      (!filters.hours ||
        now - Date.parse(r.publishedAt) <= filters.hours * 3600000) &&
      (!filters.query ||
        `${r.fish} ${r.bait} ${pointLabel(r)} ${r.author} ${r.note}`
          .toLowerCase()
          .includes(filters.query.toLowerCase())) &&
      (!filters.minFarm ||
        (r.durationMinutes > 0 && r.silver >= 0
          ? (r.silver * 60) / r.durationMinutes >= filters.minFarm
          : false)),
  );
}
export function summarize(reports) {
  const measured = reports.filter(
    (r) => Number.isFinite(r.totalWeightGrams) && r.totalWeightGrams >= 0,
  );
  const sessions = reports.filter(
    (r) =>
      Number.isFinite(r.silver) &&
      r.silver >= 0 &&
      Number.isFinite(r.durationMinutes) &&
      r.durationMinutes > 0,
  );
  const temperatures = reports.filter((r) => Number.isFinite(r.temperatureC));
  const weights = reports
    .map((r) => r.maxWeightGrams ?? weightInGrams(r.weight))
    .filter((v) => Number.isFinite(v) && v >= 0);
  const measuredCatches = measured.reduce((sum, r) => sum + r.catches, 0);
  return {
    posts: reports.length,
    catches: reports.reduce((sum, r) => sum + r.catches, 0),
    maxWeight: weights.length ? Math.max(...weights) : null,
    averageWeight: measuredCatches
      ? measured.reduce((sum, r) => sum + r.totalWeightGrams, 0) /
        measuredCatches
      : null,
    weightCoverage: measured.length,
    farm: sessions.length
      ? (sessions.reduce((sum, r) => sum + r.silver, 0) * 60) /
        sessions.reduce((sum, r) => sum + r.durationMinutes, 0)
      : null,
    farmCoverage: sessions.length,
    temperature: temperatures.length
      ? temperatures.reduce((sum, r) => sum + r.temperatureC, 0) /
        temperatures.length
      : null,
  };
}
export function groupReports(reports, field) {
  const result = new Map();
  for (const report of reports) {
    const key =
      field === "point" ? pointKey(report) : String(report[field] ?? "");
    if (!key) continue;
    const item = result.get(key) ?? {
      key,
      label: field === "point" ? pointLabel(report) : key,
      posts: 0,
      catches: 0,
      report,
    };
    item.posts++;
    item.catches += report.catches;
    result.set(key, item);
  }
  return [...result.values()].sort(
    (a, b) =>
      b.posts - a.posts ||
      b.catches - a.catches ||
      a.label.localeCompare(b.label, "ru"),
  );
}
export function chartBuckets(reports, hours = 24, now = Date.now()) {
  const count = 12;
  const windowMs = (hours || 168) * 3600000;
  const start = now - windowMs;
  const buckets = Array.from({ length: count }, (_, i) => ({
    from: start + (i * windowMs) / count,
    to: start + ((i + 1) * windowMs) / count,
    posts: 0,
    catches: 0,
  }));
  for (const r of reports) {
    const time = Date.parse(r.publishedAt);
    if (time < start || time > now) continue;
    const index = Math.min(
      count - 1,
      Math.floor(((time - start) / windowMs) * count),
    );
    buckets[index].posts++;
    buckets[index].catches += r.catches;
  }
  return buckets;
}
