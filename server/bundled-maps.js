import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(
    new URL("../public/maps/manifest.json", import.meta.url),
    "utf8",
  ),
);
const calibration = JSON.parse(
  readFileSync(
    new URL("../public/maps/calibration.json", import.meta.url),
    "utf8",
  ),
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

export const bundledMaps = Object.fromEntries(
  bundledMapMedia.map((asset) => {
    const profile = calibration.profiles[asset.waterId];
    const config = { url: asset.url, calibrated: false, sourceUrl: null };
    if (!profile || profile.imageSha256 !== asset.sha256)
      return [asset.waterId, config];
    const { imageSha256: _hash, ...bounds } = profile;
    return [asset.waterId, { ...config, ...bounds, calibrated: true }];
  }),
);

export function resolveMaps(overrides = {}) {
  const maps = { ...bundledMaps };
  for (const [waterId, config] of Object.entries(overrides)) {
    if (config === null) delete maps[waterId];
    else maps[waterId] = config;
  }
  return maps;
}
