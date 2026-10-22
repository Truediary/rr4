export interface FishingReport {
  id: string;
  waterId: string;
  fish: string;
  x: number;
  y: number;
  bait: string;
  tackle: string;
  weight: string;
  catches: number;
  publishedAt: string;
  author: string;
  sourceName: string;
  sourceUrl: string | null;
  note: string;
  demo: boolean;
  mapX?: number;
  mapY?: number;
  pointLabel?: string;
  clip?: string;
  quality?: "normal" | "trophy" | "rare" | "record";
  maxWeightGrams?: number;
  totalWeightGrams?: number;
  silver?: number;
  durationMinutes?: number;
  temperatureC?: number;
  depthM?: number;
  images?: string[];
}
export interface Filters {
  waterId: string;
  fish: string;
  bait: string;
  point: string;
  tackle: string;
  quality: string;
  clip: string;
  hours: number;
  query: string;
  minFarm: number;
}
export interface Summary {
  posts: number;
  catches: number;
  maxWeight: number | null;
  averageWeight: number | null;
  weightCoverage: number;
  farm: number | null;
  farmCoverage: number;
  temperature: number | null;
}
export interface Group {
  key: string;
  label: string;
  posts: number;
  catches: number;
  report: FishingReport;
}
export function pointKey(report: FishingReport): string;
export function pointLabel(report: FishingReport): string;
export function weightInGrams(
  value: string | number | undefined,
): number | null;
export function filterReports(
  reports: FishingReport[],
  filters: Filters,
  now?: number,
): FishingReport[];
export function summarize(reports: FishingReport[]): Summary;
export function groupReports(
  reports: FishingReport[],
  field: "point" | "fish" | "bait" | "clip",
): Group[];
export function chartBuckets(
  reports: FishingReport[],
  hours?: number,
  now?: number,
): { from: number; to: number; posts: number; catches: number }[];
