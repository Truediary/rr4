import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../public/maps/manifest.json", import.meta.url), "utf8"),
);

export const bundledMapMedia = manifest.files.map((file) => ({
  id: `rf4-map-${file.waterId}`,
  kind: "map",
  waterId: file.waterId,
  entity: file.waterName,
  label: `${file.waterName} — карта из игры`,
  url: `/maps/${file.fileName}`,
  sourceUrl: null,
  sourceLabel: `Архив пользователя «${manifest.archiveName}»`,
  origin: manifest.origin,
  createdAt: manifest.receivedAt,
  size: file.size,
  width: file.width,
  height: file.height,
  sha256: file.sha256,
}));

// The A–J / 1–10 grid does not establish the game's numeric coordinates.
export const bundledMaps = Object.fromEntries(
  bundledMapMedia.map((asset) => [asset.waterId, {
    url: asset.url,
    calibrated: false,
    sourceUrl: null,
  }]),
);

export function resolveMaps(overrides = {}) {
  const maps = { ...bundledMaps };
  for (const [waterId, config] of Object.entries(overrides)) {
    if (config === null) delete maps[waterId];
    else maps[waterId] = config;
  }
  return maps;
}
