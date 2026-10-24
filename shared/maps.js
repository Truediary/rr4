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

export function gameToMap(point, map) {
  if (
    !isCalibratedMap(map) ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  )
    return null;
  const u = (point.x - map.minX) / (map.maxX - map.minX);
  const normalizedY = (point.y - map.minY) / (map.maxY - map.minY);
  const v = map.flipY ? 1 - normalizedY : normalizedY;
  const epsilon = 1e-9;
  if (u < -epsilon || u > 1 + epsilon || v < -epsilon || v > 1 + epsilon)
    return null;
  return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
}

export function mapToGame(point, map) {
  if (
    !isCalibratedMap(map) ||
    !Number.isFinite(point.u) ||
    !Number.isFinite(point.v) ||
    point.u < 0 ||
    point.u > 1 ||
    point.v < 0 ||
    point.v > 1
  )
    return null;
  return {
    x: map.minX + point.u * (map.maxX - map.minX),
    y: map.minY + (map.flipY ? 1 - point.v : point.v) * (map.maxY - map.minY),
  };
}

export function pointFromClient(x, y, rectangle, map) {
  if (!(rectangle.width > 0 && rectangle.height > 0)) return null;
  return mapToGame(
    {
      u: (x - rectangle.left) / rectangle.width,
      v: (y - rectangle.top) / rectangle.height,
    },
    map,
  );
}

export function containImage(width, height, imageWidth, imageHeight) {
  if (
    ![width, height, imageWidth, imageHeight].every(
      (v) => Number.isFinite(v) && v > 0,
    )
  )
    return { left: 0, top: 0, width: 0, height: 0 };
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const fittedWidth = imageWidth * scale,
    fittedHeight = imageHeight * scale;
  return {
    left: (width - fittedWidth) / 2,
    top: (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

export function calibrateFromPoints(first, second) {
  if (
    ![first, second].every(
      (p) =>
        p &&
        [p.u, p.v, p.x, p.y].every(Number.isFinite) &&
        p.u >= 0 &&
        p.u <= 1 &&
        p.v >= 0 &&
        p.v <= 1 &&
        p.x >= 0 &&
        p.x <= 999 &&
        p.y >= 0 &&
        p.y <= 999,
    )
  )
    throw new Error(
      "Выберите две точки на карте и укажите их координаты из игры",
    );
  if (
    Math.abs(second.u - first.u) < 0.05 ||
    Math.abs(second.v - first.v) < 0.05 ||
    Math.abs(second.x - first.x) < 1 ||
    Math.abs(second.y - first.y) < 1
  )
    throw new Error("Выберите точки подальше друг от друга, с разными X и Y");
  const xScale = (second.x - first.x) / (second.u - first.u);
  const yScale = (second.y - first.y) / (second.v - first.v);
  if (xScale <= 0)
    throw new Error(
      "Проверьте X контрольных точек: в игре X увеличивается вправо",
    );
  const minX = first.x - first.u * xScale;
  const topY = first.y - first.v * yScale;
  const bottomY = topY + yScale;
  return {
    calibrated: true,
    minX,
    maxX: minX + xScale,
    minY: Math.min(topY, bottomY),
    maxY: Math.max(topY, bottomY),
    flipY: yScale < 0,
  };
}
