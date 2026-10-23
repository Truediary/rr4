type MapImage = { url: string; sourceUrl?: string | null };
export type CalibratedMap = MapImage & {
  calibrated?: true;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  flipY: boolean;
};
export type MapConfig = CalibratedMap | (MapImage & { calibrated: false });
export function isCalibratedMap(map: MapConfig | undefined): map is CalibratedMap;
