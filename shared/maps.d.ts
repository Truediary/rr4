export type GamePoint = { x: number; y: number };
export type PointDraft = GamePoint & { waterId: string };
export type MapPoint = { u: number; v: number };
export type ControlPoint = GamePoint & MapPoint;
export type CoordinateSource = {
  kind: "reference" | "control-points" | "manual";
  label: string;
  url?: string;
  checkedAt?: string;
  controlPoints?: ControlPoint[];
};
type MapImage = { url: string; sourceUrl?: string | null };
export type CalibratedMap = MapImage & {
  calibrated?: true;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  flipY: boolean;
  coordinateSource?: CoordinateSource;
};
export type MapConfig = CalibratedMap | (MapImage & { calibrated: false });
export function isCalibratedMap(
  map: MapConfig | undefined,
): map is CalibratedMap;
export function gameToMap(
  point: GamePoint,
  map: MapConfig | undefined,
): MapPoint | null;
export function mapToGame(
  point: MapPoint,
  map: MapConfig | undefined,
): GamePoint | null;
export function pointFromClient(
  x: number,
  y: number,
  rectangle: { left: number; top: number; width: number; height: number },
  map: MapConfig | undefined,
): GamePoint | null;
export function containImage(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; width: number; height: number };
export function calibrateFromPoints(
  first: ControlPoint,
  second: ControlPoint,
): Omit<CalibratedMap, "url">;
