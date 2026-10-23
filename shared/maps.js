export function isCalibratedMap(map) {
  return Boolean(
    map &&
      map.calibrated !== false &&
      [map.minX, map.maxX, map.minY, map.maxY].every(Number.isFinite) &&
      map.maxX > map.minX &&
      map.maxY > map.minY &&
      typeof map.flipY === "boolean",
  );
}
