import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Fish,
  MapPin,
  Search,
  Plus,
  Minus,
  Crosshair,
  Settings2,
  X,
  BarChart3,
  Bookmark,
  ExternalLink,
  Share2,
  Thermometer,
  Coins,
  Anchor,
  Camera,
  MessageSquare,
  ChevronDown,
  Filter,
  List,
  Grid3X3,
  Check,
  Info,
  Waves,
  Clock3,
  RotateCcw,
} from "lucide-react";
import {
  chartBuckets,
  filterReports,
  groupReports,
  pointKey,
  pointLabel,
  summarize,
  weightInGrams,
} from "../shared/statistics.js";
import type { FishingReport, Filters, Group } from "../shared/statistics.js";
import "./explorer.css";
import { GameImage, ImageUpload, MapReference, useMedia } from "./Media";
import { isCalibratedMap } from "../shared/maps.js";
import type { MapConfig } from "../shared/maps.js";

type Water = {
  id: string;
  name: string;
  level: number;
  kind: string;
  accent: string;
};
type SavedSearch = { id: string; name: string; filters: Filters };
const defaults: Filters = {
  waterId: "",
  fish: "",
  bait: "",
  point: "",
  tackle: "",
  quality: "",
  clip: "",
  hours: 24,
  query: "",
  minFarm: 0,
};
const number = (value: number) => Math.round(value).toLocaleString("ru-RU");
const grams = (value: number | null) =>
  value === null ? "—" : `${number(value)} г`;
const qualityNames: Record<string, string> = {
  normal: "Обычный",
  trophy: "Трофей",
  rare: "Редкий",
  record: "Рекорд",
};
function initialFilters(): Filters {
  const query = new URLSearchParams(location.search);
  return {
    ...defaults,
    waterId: query.get("water") || "",
    point: query.get("point") || "",
    fish: query.get("fish") || "",
    bait: query.get("bait") || "",
    tackle: query.get("tackle") || "",
    quality: query.get("quality") || "",
    clip: query.get("clip") || "",
    query: query.get("q") || "",
    hours:
      query.has("hours") &&
      [0, 1, 6, 24, 72, 168].includes(Number(query.get("hours")))
        ? Number(query.get("hours"))
        : 24,
    minFarm: Math.max(0, Math.min(2000, Number(query.get("minFarm")) || 0)),
  };
}
function readSaved(): SavedSearch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("klev-searches") || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (s) =>
              typeof s.id === "string" &&
              typeof s.name === "string" &&
              s.filters &&
              typeof s.filters === "object",
          )
          .slice(0, 12)
      : [];
  } catch {
    return [];
  }
}
async function mapRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api/maps${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Не удалось сохранить карту");
  return data;
}

function GroupList({
  title,
  groups,
  value,
  onPick,
  kind,
}: {
  title: string;
  groups: Group[];
  value: string;
  onPick: (key: string) => void;
  kind: "fish" | "bait" | "point" | "clip";
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const found = groups.filter((g) =>
    g.label.toLowerCase().includes(query.toLowerCase()),
  );
  const visible = expanded ? found : found.slice(0, 8);
  return (
    <section className={`distribution distribution-${kind}`}>
      <div className="distribution-title">
        <strong>{title}</strong>
        {kind === "fish" && (
          <span
            className="quality-legend"
            title="Трофеи, редкие трофеи и рекорды"
          >
            <i />
            <i />
            <i />
          </span>
        )}
        <small>постов</small>
      </div>
      {kind !== "clip" && (
        <label className="distribution-search">
          <Search size={11} />
          <input
            aria-label={`Найти: ${title}`}
            placeholder={title}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <div className="distribution-items">
        {visible.map((g, i) => (
          <button
            key={g.key}
            className={`distribution-item ${value === g.key ? "chosen" : ""}`}
            onClick={() => onPick(g.key)}
            title={`${g.label}: ${g.posts} постов, ${g.catches} уловов`}
          >
            {kind === "fish" ? (
              <GameImage
                kind="fish"
                entity={g.label}
                className="catalog-game-image"
              />
            ) : kind === "bait" ? (
              <GameImage
                kind="bait"
                entity={g.label}
                className="catalog-game-image"
              />
            ) : kind === "clip" ? (
              <span className="clip-token">{g.label}</span>
            ) : null}
            <span className={kind === "point" ? "point-token" : ""}>
              {kind === "clip" ? "" : g.label}
            </span>
            <b>{g.posts}</b>
          </button>
        ))}
        {!visible.length && <p className="distribution-empty">Нет данных</p>}
      </div>
      {found.length > 8 && (
        <button className="show-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "свернуть" : "больше"}
          <ChevronDown size={10} />
        </button>
      )}
    </section>
  );
}

function Chart({
  reports,
  hours,
}: {
  reports: FishingReport[];
  hours: number;
}) {
  const [metric, setMetric] = useState<"posts" | "catches">("catches");
  const buckets = chartBuckets(reports, hours);
  const max = Math.max(1, ...buckets.map((b) => b[metric]));
  return (
    <figure className="history-chart">
      <div>
        <strong>Активность за период</strong>
        <select
          aria-label="Показатель графика"
          value={metric}
          onChange={(e) => setMetric(e.target.value as "posts" | "catches")}
        >
          <option value="catches">Уловы</option>
          <option value="posts">Посты</option>
        </select>
      </div>
      <svg
        viewBox="0 0 840 160"
        role="img"
        aria-label={`График: ${metric === "catches" ? "уловы" : "посты"} по времени`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="38"
              x2="825"
              y1={20 + i * 34}
              y2={20 + i * 34}
              stroke="#d8ddd6"
              strokeDasharray="3 3"
            />
            <text x="28" y={24 + i * 34} textAnchor="end">
              {number(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <g key={i}>
            <rect
              x={48 + i * 64}
              y={122 - (b[metric] / max) * 102}
              width="38"
              height={(b[metric] / max) * 102}
              rx="2"
              fill="#6e974b"
            >
              <title>
                {new Date(b.from).toLocaleString("ru-RU")}: {b[metric]}
              </title>
            </rect>
            {i % 2 === 0 && (
              <text x={67 + i * 64} y="146" textAnchor="middle">
                {new Date(b.from).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption>
        Рассчитано по датам публикаций. Пустой столбец означает отсутствие
        отчётов.
      </figcaption>
    </figure>
  );
}

function Statistics({
  reports,
  filters,
  waters,
  onPatch,
  onPoint,
  onSave,
  onReset,
  compact = false,
}: {
  reports: FishingReport[];
  filters: Filters;
  waters: Water[];
  onPatch: (patch: Partial<Filters>) => void;
  onPoint: (key: string) => void;
  onSave: () => void;
  onReset: () => void;
  compact?: boolean;
}) {
  const summary = summarize(reports);
  const [expanded, setExpanded] = useState(true);
  const [graph, setGraph] = useState(false);
  const [extra, setExtra] = useState(false);
  const chips = [
    {
      key: "waterId" as const,
      label: "Водоём",
      value: waters.find((w) => w.id === filters.waterId)?.name,
    },
    { key: "fish" as const, label: "Рыба", value: filters.fish },
    { key: "bait" as const, label: "Наживка", value: filters.bait },
    {
      key: "point" as const,
      label: "Точка",
      value:
        reports[0] && filters.point
          ? pointLabel(reports[0])
          : filters.point.split("|")[1],
    },
    { key: "tackle" as const, label: "Снасть", value: filters.tackle },
    { key: "clip" as const, label: "Клипса", value: filters.clip },
    {
      key: "quality" as const,
      label: "Категория",
      value: qualityNames[filters.quality],
    },
  ].filter((c) => c.value);
  return (
    <section
      className={`reference-statistics ${compact ? "compact-statistics" : ""}`}
    >
      <div className="stats-title-row">
        <h2>Статистика по выбранным фильтрам</h2>
        <button
          className={graph ? "small-dark active" : "small-dark"}
          onClick={() => setGraph(!graph)}
        >
          <BarChart3 size={12} />
          График
        </button>
      </div>
      <div className="stats-controls">
        <div className="filter-chips">
          <span>
            Период выборки:{" "}
            {filters.hours === 0
              ? "всё время"
              : filters.hours < 24
                ? `${filters.hours} ч.`
                : `${filters.hours / 24} дн.`}
          </span>
          {chips.map((c) => (
            <button key={c.key} onClick={() => onPatch({ [c.key]: "" })}>
              {c.label}: {c.value}
              <X size={10} />
            </button>
          ))}
        </div>
        <div className="stat-actions">
          <button onClick={onSave}>
            <Bookmark size={11} />
            Сохранить поиск
          </button>
          <button onClick={onReset}>Сбросить</button>
          <button
            className="green-outline"
            onClick={() => setExtra(!extra)}
            aria-expanded={extra}
          >
            <Settings2 size={11} />
            Другие фильтры
          </button>
        </div>
      </div>
      {extra && (
        <div className="statistics-extra-filters">
          <label>
            Снасть
            <select
              aria-label="Дополнительная снасть"
              value={filters.tackle}
              onChange={(e) => onPatch({ tackle: e.target.value })}
            >
              <option value="">Любая</option>
              {["Донная", "Поплавочная", "Спиннинговая"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select
              aria-label="Дополнительная категория"
              value={filters.quality}
              onChange={(e) => onPatch({ quality: e.target.value })}
            >
              <option value="">Все уловы</option>
              {Object.entries(qualityNames).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Клипса
            <input
              aria-label="Клипса"
              value={filters.clip}
              onChange={(e) => onPatch({ clip: e.target.value })}
              placeholder="Любая"
            />
          </label>
        </div>
      )}
      <div className="metric-table">
        {[
          { name: "Посты", value: number(summary.posts), test: "posts" },
          { name: "Улов", value: number(summary.catches), test: "catches" },
          {
            name: "Максимальный вес",
            value: grams(summary.maxWeight),
            test: "max",
          },
          {
            name: "Средний вес",
            value: grams(summary.averageWeight),
            test: "average",
            hint: `Суммарный вес указан в ${summary.weightCoverage} из ${summary.posts} отчётов`,
          },
          {
            name: "Фарм в час",
            value: summary.farm === null ? "—" : number(summary.farm),
            test: "farm",
            icon: <Coins size={11} />,
            hint: `По ${summary.farmCoverage} отчётам с доходом и длительностью. Взвешено по времени.`,
          },
          {
            name: "Ср. температура",
            value:
              summary.temperature === null
                ? "—"
                : `${summary.temperature.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}°`,
            test: "temperature",
            icon: <Thermometer size={11} />,
          },
        ].map((m) => (
          <div key={m.test} title={m.hint}>
            <strong>{m.name}</strong>
            <span data-testid={`stat-${m.test}`}>
              {m.icon}
              {m.value}
            </span>
          </div>
        ))}
      </div>
      {graph && <Chart reports={reports} hours={filters.hours} />}
      <button
        className="stats-detail-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? "Скрыть подробную статистику"
          : "Показать подробную статистику"}
      </button>
      {expanded && (
        <>
          <div className="distributions">
            <GroupList
              title="Рыба"
              groups={groupReports(reports, "fish")}
              value={filters.fish}
              onPick={(key) =>
                onPatch({ fish: filters.fish === key ? "" : key })
              }
              kind="fish"
            />
            <GroupList
              title="Наживка"
              groups={groupReports(reports, "bait")}
              value={filters.bait}
              onPick={(key) =>
                onPatch({ bait: filters.bait === key ? "" : key })
              }
              kind="bait"
            />
            {!compact && (
              <GroupList
                title="Точка"
                groups={groupReports(reports, "point")}
                value={filters.point}
                onPick={onPoint}
                kind="point"
              />
            )}
          </div>
          {compact && (
            <GroupList
              title="Клипса"
              groups={groupReports(reports, "clip")}
              value={filters.clip}
              onPick={(key) =>
                onPatch({ clip: filters.clip === key ? "" : key })
              }
              kind="clip"
            />
          )}
        </>
      )}
      <p className="stats-footnote">
        Средний вес и фарм рассчитываются только при наличии исходных измерений.
        Наведите на показатель для подробностей.
      </p>
    </section>
  );
}

function CoordinateSettings({ map }: { map?: MapConfig }) {
  const calibration = isCalibratedMap(map) ? map : undefined;
  const [enabled, setEnabled] = useState(Boolean(calibration));
  return (
    <div className="map-coordinate-settings">
      <label className="map-flip">
        <input
          type="checkbox"
          name="calibrated"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Наложить точки по игровым координатам
      </label>
      {enabled ? (
        <>
          <p>Укажите игровые координаты краёв изображения. Сетка A–J и 1–10 не задаёт эти значения.</p>
          <div className="map-bounds">
            {[
              ["minX", "X слева"],
              ["maxX", "X справа"],
              ["minY", "Минимальная Y"],
              ["maxY", "Максимальная Y"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type="number"
                  step="any"
                  required
                  defaultValue={calibration?.[name as "minX" | "maxX" | "minY" | "maxY"] ?? ""}
                />
              </label>
            ))}
          </div>
          <label className="map-flip">
            <input type="checkbox" name="flipY" defaultChecked={calibration?.flipY ?? true} />
            Y растёт снизу вверх
          </label>
        </>
      ) : (
        <p>Карта будет доступна для просмотра и увеличения. Отчёты можно открыть по списку координат под картой.</p>
      )}
    </div>
  );
}

function WaterMap({
  water,
  reports,
  onPoint,
  map,
  onConfigure,
}: {
  water: Water;
  reports: FishingReport[];
  onPoint: (key: string) => void;
  map?: MapConfig;
  onConfigure: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const groups = groupReports(reports, "point");
  const calibratedMap = isCalibratedMap(map) ? map : undefined;
  const summary = summarize(reports);
  const { assets } = useMedia();
  const source = map?.sourceUrl || assets.find((a) => a.url === map?.url)?.sourceUrl;

  return (
    <article className="water-stat-card" data-water={water.id}>
      <header>
        <button
          className="water-name"
          onClick={() => onPoint("water:" + water.id)}
        >
          {water.name}
        </button>
        <button className="water-info-button" onClick={onConfigure}>
          Карта
        </button>
        <span className="water-temperature">
          <Thermometer size={12} />
          {summary.temperature === null
            ? "—"
            : `${Math.round(summary.temperature)}°`}
        </span>
        <button
          className="water-configure"
          aria-label={`Настроить карту: ${water.name}`}
          onClick={onConfigure}
        >
          <Settings2 size={13} />
        </button>
      </header>
      <div className="water-badges">
        <span>Наживки {groupReports(reports, "bait").length}</span>
        <span>Видов рыб {groupReports(reports, "fish").length}</span>
        <span>Точек {groups.length}</span>
      </div>
      <div className="water-summary">
        Посты: <b>{summary.posts}</b> Улов: <b>{summary.catches}</b>
        <button onClick={() => onPoint("water:" + water.id)}>Подробнее</button>
      </div>
      <div
        className={`reference-map ${zoom > 1 ? "zoomed" : ""}`}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button") || zoom === 1) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({
            x: Math.max(
              -200,
              Math.min(200, drag.current.ox + e.clientX - drag.current.x),
            ),
            y: Math.max(
              -200,
              Math.min(200, drag.current.oy + e.clientY - drag.current.y),
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="reference-map-content"
          style={{
            transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
          }}
        >
          {map && (
            <img
              className={`real-water-map ${calibratedMap ? "" : "reference-only"} ${ready ? "ready" : ""}`}
              src={map.url}
              alt={`Карта: ${water.name}`}
              onLoad={() => {
                setReady(true);
                setFailed(false);
              }}
              onError={() => {
                setReady(false);
                setFailed(true);
              }}
              draggable={false}
            />
          )}
          {!(map && ready) && (
            <div className="real-image-missing">
              <MapPin size={27} />
              <strong>
                {map && !failed
                  ? "Загрузка карты…"
                  : map
                    ? "Изображение карты недоступно"
                    : "Карта из игры не добавлена"}
              </strong>
              <span>
                Загрузите изображение карты из игры.
              </span>
              <button onClick={onConfigure}>Подключить карту</button>
            </div>
          )}
          {calibratedMap &&
            ready &&
            groups.map((g) => {
              const x = ((g.report.x - calibratedMap.minX) / (calibratedMap.maxX - calibratedMap.minX)) * 100;
              const normalizedY =
                ((g.report.y - calibratedMap.minY) / (calibratedMap.maxY - calibratedMap.minY)) * 100;
              const y = calibratedMap.flipY ? 100 - normalizedY : normalizedY;
              if (x < 0 || x > 100 || y < 0 || y > 100) return null;
              return (
                <button
                  key={g.key}
                  className={`cluster-marker ${g.posts >= 3 ? "red" : g.posts >= 2 ? "yellow" : "green"}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-label={`${water.name}, точка ${g.label}: ${g.posts} постов`}
                  onClick={() => onPoint(g.key)}
                >
                  <span>{g.posts > 1 ? g.posts : ""}</span>
                </button>
              );
            })}
        </div>
        {map && ready && (
          <div className="reference-map-tools">
            <button
              aria-label={`Увеличить: ${water.name}`}
              onClick={() => setZoom((v) => Math.min(3, v + 0.5))}
            >
              <Plus size={19} />
            </button>
            <button
              aria-label={`Уменьшить: ${water.name}`}
              onClick={() => {
                setZoom((v) => Math.max(1, v - 0.5));
                setOffset({ x: 0, y: 0 });
              }}
            >
              <Minus size={17} />
            </button>
            <button
              aria-label={`Сбросить карту: ${water.name}`}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <Crosshair size={15} />
            </button>
          </div>
        )}
        <span className="map-status-badge">
          {map && ready ? "Карта пользователя" : "Нет игровой карты"}
        </span>
        {map && ready && (
          <span className="map-caption">
            {calibratedMap ? "Метки по настроенной сетке" : "Координатная привязка не задана"}{" "}
            {source && (
              <a href={source} target="_blank" rel="noreferrer">
                Источник
              </a>
            )}
          </span>
        )}
        {!reports.length && map && ready && (
          <span className="no-map-data">Нет отчётов за выбранный период</span>
        )}
      </div>
      {!(calibratedMap && ready) && groups.length > 0 && (
        <div className="unmapped-points">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => onPoint(g.key)}
              aria-label={`Открыть точку ${g.label}: ${water.name}`}
            >
              {g.label}
              <b>{g.posts} пост.</b>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function ReportPhoto({
  report,
  onImage,
}: {
  report: FishingReport;
  onImage: (url: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = report.images?.[0];
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <button
      className="post-photo-preview"
      onClick={() => onImage(url)}
      aria-label="Открыть фото улова"
    >
      <img
        src={url}
        alt={`Улов: ${report.fish}`}
        onError={() => setFailed(true)}
      />
    </button>
  ) : (
    <GameImage
      kind="fish"
      entity={report.fish}
      className="specimen-game-image"
      fallback="Скриншот не добавлен"
    />
  );
}

function CatchCard({
  report,
  water,
  favorite,
  onFavorite,
  onImage,
}: {
  report: FishingReport;
  water?: Water;
  favorite: boolean;
  onFavorite: () => void;
  onImage: (url: string) => void;
}) {
  return (
    <article
      className={`catch-post ${report.quality === "trophy" ? "trophy-post" : ""}`}
    >
      <div className="catch-post-body">
        <div className="catch-post-header">
          <time>
            {new Date(report.publishedAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <small>
              <Thermometer size={10} />
              {report.temperatureC ?? "—"}°
            </small>
          </time>
          <span className="catch-water">{water?.name}</span>
          <div>
            <span className="post-point">
              <MapPin size={11} />
              <b>{pointLabel(report)}</b>
              {report.clip && <i>{report.clip}</i>}
            </span>
            <span className="catch-author">{report.author}</span>
          </div>
        </div>
        <div className="fish-catch-display">
          <button
            className={`catch-bookmark ${favorite ? "active" : ""}`}
            onClick={onFavorite}
            aria-label={`${favorite ? "Убрать из избранного" : "В избранное"}: ${report.fish}`}
          >
            <Bookmark size={17} fill={favorite ? "currentColor" : "none"} />
          </button>
          <div className="fish-catch-specimen">
            <ReportPhoto report={report} onImage={onImage} />
            <span>
              {grams(report.maxWeightGrams ?? weightInGrams(report.weight))}
            </span>
            <strong>{report.fish}</strong>
            {report.quality && report.quality !== "normal" && (
              <em className={`quality-tag ${report.quality}`}>
                {qualityNames[report.quality]}
              </em>
            )}
          </div>
          <div className="fish-catch-total">
            <span>
              <Fish size={17} />
              <strong>{report.catches}</strong>
            </span>
            <small>уловов</small>
            {report.silver !== undefined && (
              <small>
                <Coins size={11} />
                {number(report.silver)}
              </small>
            )}
          </div>
        </div>
        <div className="catch-rig">
          <span title={report.tackle}>
            <Anchor size={18} />
          </span>
          <span>{report.bait}</span>
          {report.depthM !== undefined && (
            <small>Глубина {report.depthM} м</small>
          )}
          {report.durationMinutes !== undefined && (
            <small>
              <Clock3 size={10} />
              {report.durationMinutes} мин
            </small>
          )}
        </div>
      </div>
      {report.images && report.images.length > 0 && (
        <div className="post-attachments">
          {report.images.map((url, i) => (
            <button
              key={i}
              onClick={() => onImage(url)}
              aria-label={`Скриншот ${i + 1}`}
            >
              <img
                src={url}
                alt={`Скриншот улова ${i + 1}`}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <Camera size={15} />
            </button>
          ))}
        </div>
      )}
      {report.note && (
        <p className="catch-comment">
          <MessageSquare size={12} />
          {report.note}
        </p>
      )}
      <footer>
        <span>
          #{report.id.slice(-7)}{" "}
          {report.demo && <b className="demo-post-label">ДЕМО</b>}
        </span>
        <span>{report.sourceName}</span>
        {report.sourceUrl ? (
          <a href={report.sourceUrl} target="_blank" rel="noreferrer">
            Источник
            <ExternalLink size={11} />
          </a>
        ) : (
          <span className="no-post-source">Без внешней ссылки</span>
        )}
      </footer>
    </article>
  );
}

export default function Explorer({
  reports,
  waters,
  demo,
  loading,
  favorites,
  onFavorite,
  onAdd,
  onNotify,
  title: heading = "Точки клёва и статистика",
  initialView = "maps",
}: {
  reports: FishingReport[];
  title?: string;
  initialView?: string;
  waters: Water[];
  demo: boolean;
  loading: boolean;
  favorites: string[];
  onFavorite: (id: string) => void;
  onAdd: () => void;
  onNotify: (message: string) => void;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sort, setSort] = useState("catches");
  const [view, setView] = useState(initialView);
  const [point, setPoint] = useState<string | null>(null);
  const [mapEditor, setMapEditor] = useState<Water | null>(null);
  const [maps, setMaps] = useState<Record<string, MapConfig>>({});
  const [savingMap, setSavingMap] = useState(false);
  const [saved, setSaved] = useState<SavedSearch[]>(readSaved);
  const [image, setImage] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const patch = (value: Partial<Filters>) =>
    setFilters((old) => ({ ...old, ...value }));
  const filtered = useMemo(
    () => filterReports(reports, filters),
    [reports, filters],
  );
  const actualWaters = waters
    .filter((w) => !filters.waterId || w.id === filters.waterId)
    .map((w) => ({
      water: w,
      reports: filtered.filter((r) => r.waterId === w.id),
    }))
    .sort((a, b) =>
      sort === "water"
        ? a.water.name.localeCompare(b.water.name, "ru")
        : summarize(b.reports).catches - summarize(a.reports).catches,
    );
  const modalWater = point?.startsWith("water:")
    ? point.slice(6)
    : point?.split("|")[0];
  const pointFilters = {
    ...filters,
    waterId: modalWater || filters.waterId,
    point: point?.startsWith("water:") ? "" : point || "",
  };
  const modalReports = filterReports(reports, pointFilters).sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const selectedReport = reports.find((r) => pointKey(r) === point);
  const title = point?.startsWith("water:")
    ? waters.find((w) => w.id === modalWater)?.name
    : selectedReport
      ? pointLabel(selectedReport)
      : point?.split("|")[1];
  useEffect(() => {
    mapRequest("")
      .then(setMaps)
      .catch((e) => onNotify(e.message));
  }, []);
  useEffect(() => {
    setPoint(null);
  }, [demo]);
  useEffect(() => {
    try {
      localStorage.setItem("klev-searches", JSON.stringify(saved));
    } catch {
      onNotify("Браузер не разрешил сохранить поиск.");
    }
  }, [saved]);
  const dialogOpen = Boolean(point || mapEditor || image);
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          image ? ".image-lightbox button" : ".reference-dialog button",
        )
        ?.focus(),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (image) setImage(null);
        else {
          setPoint(null);
          setMapEditor(null);
        }
      }
      if (e.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(
          image ? ".image-lightbox" : ".reference-dialog",
        );
        const items = [
          ...(dialog?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], input, select",
          ) || []),
        ];
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dialogOpen, image]);
  function saveSearch() {
    const water = waters.find((w) => w.id === filters.waterId)?.name;
    setSaved((old) =>
      [
        {
          id: crypto.randomUUID(),
          name:
            [water, filters.fish, filters.bait].filter(Boolean).join(" · ") ||
            `Все водоёмы · ${filters.hours ? `${filters.hours} ч` : "всё время"}`,
          filters: { ...filters },
        },
        ...old,
      ].slice(0, 12),
    );
    onNotify("Поиск сохранён в этом браузере.");
  }
  async function share() {
    const url = new URL(location.href);
    url.search = "";
    if (modalWater) url.searchParams.set("water", modalWater);
    if (point && !point.startsWith("water:"))
      url.searchParams.set("point", point);
    if (filters.fish) url.searchParams.set("fish", filters.fish);
    if (filters.bait) url.searchParams.set("bait", filters.bait);
    url.searchParams.set("hours", String(filters.hours));
    for (const key of ["tackle", "quality", "clip"] as const)
      if (filters[key]) url.searchParams.set(key, filters[key]);
    if (filters.minFarm)
      url.searchParams.set("minFarm", String(filters.minFarm));
    if (filters.query) url.searchParams.set("q", filters.query);
    try {
      await navigator.clipboard.writeText(url.href);
      onNotify(
        "Ссылка на выборку скопирована. Она доступна тем, у кого открыт этот сайт.",
      );
    } catch {
      onNotify("Браузер не разрешил копирование ссылки.");
    }
  }
  async function saveMap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mapEditor) return;
    const form = new FormData(e.currentTarget);
    if (form.getAll("_uploadBusy").includes("1")) {
      onNotify("Дождитесь загрузки карты");
      return;
    }
    const calibrated = form.get("calibrated") === "on";
    setSavingMap(true);
    try {
      const config = await mapRequest("/" + mapEditor.id, {
        method: "PUT",
        body: JSON.stringify({
          url: form.get("url"),
          calibrated,
          ...(calibrated ? {
            minX: Number(form.get("minX")),
            maxX: Number(form.get("maxX")),
            minY: Number(form.get("minY")),
            maxY: Number(form.get("maxY")),
            flipY: form.get("flipY") === "on",
          } : {}),
          sourceUrl: String(form.get("sourceUrl") || "").trim() || null,
        }),
      });
      setMaps((old) => ({ ...old, [mapEditor.id]: config }));
      setMapEditor(null);
      onNotify(calibrated ? "Карта и координатная сетка сохранены." : "Карта сохранена для просмотра.");
    } catch (e) {
      onNotify((e as Error).message);
    } finally {
      setSavingMap(false);
    }
  }
  return (
    <div className="reference-explorer">
      <div className="reference-heading">
        <div>
          <span>РУССКАЯ РЫБАЛКА 4 / НАВИГАТОР</span>
          <h1>{heading}</h1>
        </div>
        <button className="reference-add" onClick={onAdd}>
          <Plus size={14} />
          Добавить точку
        </button>
      </div>
      <div className="reference-search">
        <Search size={16} />
        <input
          aria-label="Поиск по отчётам"
          placeholder="Рыба, наживка, координаты или текст отчёта"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
        {filters.query && (
          <button
            aria-label="Очистить поиск"
            onClick={() => patch({ query: "" })}
          >
            <X size={14} />
          </button>
        )}
        <span>{demo ? "Демонстрационный каталог" : "Отчёты сообщества"}</span>
      </div>
      {saved.length > 0 && (
        <div className="saved-searches">
          <Bookmark size={12} />
          <span>Мои поиски:</span>
          {saved.map((s) => (
            <div key={s.id}>
              <button onClick={() => setFilters({ ...defaults, ...s.filters })}>
                {s.name}
              </button>
              <button
                aria-label={`Удалить поиск: ${s.name}`}
                onClick={() =>
                  setSaved((old) => old.filter((v) => v.id !== s.id))
                }
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="reference-sort">
        <span>
          <i className="live-dot" />
          {filtered.length} постов в выборке
        </span>
        <div>
          сортировка:
          <button
            className={sort === "catches" ? "active" : ""}
            onClick={() => setSort("catches")}
          >
            По улову
          </button>
          <i />{" "}
          <button
            className={sort === "water" ? "active" : ""}
            onClick={() => setSort("water")}
          >
            По водоёму
          </button>
          <span className="reference-view-toggle">
            <button
              aria-label="Карты водоёмов"
              className={view === "maps" ? "active" : ""}
              onClick={() => setView("maps")}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              aria-label="Лента отчётов"
              className={view === "posts" ? "active" : ""}
              onClick={() => setView("posts")}
            >
              <List size={16} />
            </button>
          </span>
        </div>
      </div>
      <div className="reference-columns">
        <div className="reference-main">
          <Statistics
            reports={filtered}
            filters={filters}
            waters={waters}
            onPatch={patch}
            onPoint={setPoint}
            onSave={saveSearch}
            onReset={() => setFilters({ ...defaults })}
          />
          <div className="map-grid-caption">
            <span>
              {view === "maps" ? "Водоёмы и точки" : "Публикации рыболовов"}
              <b>{view === "maps" ? actualWaters.length : filtered.length}</b>
            </span>
            {view === "maps" && (
              <small>
                <i className="legend-marker red" />
                3+ поста <i className="legend-marker yellow" />2 поста{" "}
                <i className="legend-marker green" />1 пост
              </small>
            )}
          </div>
          {loading ? (
            <div className="reference-empty">Загрузка отчётов…</div>
          ) : view === "maps" ? (
            <>
              <div className="water-map-grid">
                {actualWaters.map(({ water, reports }) => (
                  <WaterMap
                    key={`${water.id}:${maps[water.id]?.url || ""}`}
                    water={water}
                    reports={reports}
                    map={maps[water.id]}
                    onPoint={setPoint}
                    onConfigure={() => setMapEditor(water)}
                  />
                ))}
              </div>
              {!filtered.length && (
                <div className="reference-empty">
                  <MapPin size={27} />
                  <strong>По этим фильтрам отчётов нет</strong>
                  <p>Измените выборку или добавьте свой улов.</p>
                  <button onClick={() => setFilters({ ...defaults })}>
                    Сбросить фильтры
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="catch-post-grid">
              {filtered.map((r) => (
                <CatchCard
                  key={r.id}
                  report={r}
                  water={waters.find((w) => w.id === r.waterId)}
                  favorite={favorites.includes(r.id)}
                  onFavorite={() => onFavorite(r.id)}
                  onImage={setImage}
                />
              ))}
              {!filtered.length && (
                <div className="reference-empty">
                  Нет отчётов по выбранным фильтрам
                </div>
              )}
            </div>
          )}
        </div>
        <aside
          className={`reference-filter-panel ${filterOpen ? "expanded" : ""}`}
        >
          <button
            className="mobile-filters-toggle"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter size={14} />
            Фильтры
            <ChevronDown size={13} />
          </button>
          <div className="reference-filter-content">
            <div className="filter-panel-heading">
              <Filter size={13} />
              <strong>Параметры выборки</strong>
              <button
                aria-label="Сбросить фильтры"
                onClick={() => setFilters({ ...defaults })}
              >
                <RotateCcw size={12} />
              </button>
            </div>
            <label>
              Период выборки
              <select
                aria-label="Период выборки"
                value={filters.hours}
                onChange={(e) => patch({ hours: Number(e.target.value) })}
              >
                <option value={1}>Последний час</option>
                <option value={6}>Последние 6 часов</option>
                <option value={24}>1 день</option>
                <option value={72}>3 дня</option>
                <option value={168}>7 дней</option>
                <option value={0}>Всё время</option>
              </select>
            </label>
            <div className="period-presets">
              {[1, 6, 24, 168].map((v) => (
                <button
                  key={v}
                  className={filters.hours === v ? "active" : ""}
                  onClick={() => patch({ hours: v })}
                >
                  {v < 24 ? `${v}ч` : `${v / 24}дн`}
                </button>
              ))}
            </div>
            <label>
              Водоём
              <select
                aria-label="Водоём"
                value={filters.waterId}
                onChange={(e) => patch({ waterId: e.target.value, point: "" })}
              >
                <option value="">Все водоёмы</option>
                {waters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Точка
              <select
                aria-label="Точка"
                value={filters.point}
                onChange={(e) => patch({ point: e.target.value })}
              >
                <option value="">Все точки</option>
                {groupReports(
                  reports.filter(
                    (r) => !filters.waterId || r.waterId === filters.waterId,
                  ),
                  "point",
                ).map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label} ·{" "}
                    {waters.find((w) => w.id === g.report.waterId)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Рыба
              <select
                aria-label="Рыба"
                value={filters.fish}
                onChange={(e) => patch({ fish: e.target.value })}
              >
                <option value="">Любая рыба</option>
                {[...new Set(reports.map((r) => r.fish))]
                  .sort((a, b) => a.localeCompare(b, "ru"))
                  .map((f) => (
                    <option key={f}>{f}</option>
                  ))}
              </select>
            </label>
            <label>
              Категория
              <select
                aria-label="Категория"
                value={filters.quality}
                onChange={(e) => patch({ quality: e.target.value })}
              >
                <option value="">Все уловы</option>
                {Object.entries(qualityNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Наживка
              <select
                aria-label="Наживка"
                value={filters.bait}
                onChange={(e) => patch({ bait: e.target.value })}
              >
                <option value="">Любая наживка</option>
                {[...new Set(reports.map((r) => r.bait))]
                  .sort((a, b) => a.localeCompare(b, "ru"))
                  .map((b) => (
                    <option key={b}>{b}</option>
                  ))}
              </select>
            </label>
            <label>
              Снасть
              <select
                aria-label="Снасть"
                value={filters.tackle}
                onChange={(e) => patch({ tackle: e.target.value })}
              >
                <option value="">Любая снасть</option>
                {["Донная", "Поплавочная", "Спиннинговая"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Фарм в час: {filters.minFarm ? `${filters.minFarm}+` : "любой"}
              <input
                aria-label="Минимальный фарм в час"
                type="range"
                min="0"
                max="2000"
                step="100"
                value={filters.minFarm}
                onChange={(e) => patch({ minFarm: Number(e.target.value) })}
              />
            </label>
            <div className="farm-range-labels">
              <span>любой</span>
              <span>2 000+</span>
            </div>
            <button
              className="filter-reset"
              onClick={() => setFilters({ ...defaults })}
            >
              Сбросить фильтры
            </button>
            <div className="reference-help">
              <Info size={15} />
              <p>
                Цифры на карте — число постов в точке. Нажмите, чтобы увидеть
                снасти и уловы.
              </p>
            </div>
            <p className="reference-data-note">
              {demo
                ? "Включён деморежим. Все точки, уловы и измерения вымышлены."
                : "Только сохранённые отчёты. Недостающие измерения показаны прочерком."}
            </p>
          </div>
        </aside>
      </div>
      {point && (
        <div
          className="reference-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPoint(null);
          }}
        >
          <section
            className="reference-dialog point-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Точка ${title}`}
          >
            <header className="reference-dialog-header">
              <h2>{title}</h2>
              <span>{waters.find((w) => w.id === modalWater)?.name}</span>
              <button aria-label="Поделиться выборкой" onClick={share}>
                <Share2 size={15} />
              </button>
              <button
                aria-label="Закрыть отчёты"
                onClick={() => setPoint(null)}
              >
                <X size={17} />
              </button>
            </header>
            <div className="point-dialog-scroll">
              <div className="selection-summary">
                Список постов по заданным фильтрам:{" "}
                <strong>
                  Период выборки:{" "}
                  {filters.hours ? `${filters.hours} ч.` : "всё время"}; Водоём:{" "}
                  {waters.find((w) => w.id === modalWater)?.name}
                  {!point.startsWith("water:") && `; Точка: ${title}`}
                </strong>
              </div>
              <Statistics
                reports={modalReports}
                filters={pointFilters}
                waters={waters}
                compact
                onPatch={(value) => {
                  if (value.point === "" || value.waterId === "") {
                    setPoint(null);
                    return;
                  }
                  patch(value);
                }}
                onPoint={setPoint}
                onSave={() => {
                  setSaved((old) =>
                    [
                      {
                        id: crypto.randomUUID(),
                        name: `${waters.find((w) => w.id === modalWater)?.name} · ${title}`,
                        filters: pointFilters,
                      },
                      ...old,
                    ].slice(0, 12),
                  );
                  onNotify("Поиск по точке сохранён.");
                }}
                onReset={() =>
                  patch({
                    fish: "",
                    bait: "",
                    quality: "",
                    clip: "",
                    tackle: "",
                    query: "",
                    minFarm: 0,
                  })
                }
              />
              <div className="point-posts-heading">
                <strong>
                  Посты по точке <span>{modalReports.length}</span>
                </strong>
                <span>
                  {demo ? "Демонстрационные отчёты" : "Сначала свежие"}
                </span>
              </div>
              <div className="catch-post-grid">
                {modalReports.map((r) => (
                  <CatchCard
                    key={r.id}
                    report={r}
                    water={waters.find((w) => w.id === r.waterId)}
                    favorite={favorites.includes(r.id)}
                    onFavorite={() => onFavorite(r.id)}
                    onImage={setImage}
                  />
                ))}
                {!modalReports.length && (
                  <div className="reference-empty">
                    По текущим фильтрам нет постов. Сбросьте фильтры в
                    статистике выше.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
      {mapEditor && (
        <div
          className="reference-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMapEditor(null);
          }}
        >
          <section
            className="reference-dialog map-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Настройка карты"
          >
            <header className="reference-dialog-header">
              <h2>Карта водоёма</h2>
              <button
                aria-label="Закрыть настройки карты"
                onClick={() => setMapEditor(null)}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={saveMap} className="map-editor-form">
              <h3>{mapEditor.name}</h3>
              <p>
                Подключите изображение, которое разрешено использовать.
                Координатную привязку можно настроить позже. Настройка общая для всех
                посетителей этого экземпляра сайта.
              </p>
              <MapReference />
              <div className="form-field">
                <span>Карта из игры</span>
                <ImageUpload
                  kind="map"
                  name="url"
                  single
                  required
                  defaultValue={maps[mapEditor.id]?.url || ""}
                />
              </div>
              <label className="map-source-field">
                Страница источника карты
                <input
                  name="sourceUrl"
                  type="url"
                  maxLength={2000}
                  placeholder="https://rf4map.ru/…"
                  defaultValue={maps[mapEditor.id]?.sourceUrl || ""}
                />
              </label>
              <CoordinateSettings map={maps[mapEditor.id]} />
              <p className="map-editor-note">
                Метки появятся на карте после настройки координатной привязки.
              </p>
              <div className="map-editor-actions">
                <button
                  className="green-outline"
                  type="submit"
                  disabled={savingMap}
                >
                  <Check size={14} />
                  {savingMap ? "Сохраняем…" : "Сохранить карту"}
                </button>
                {maps[mapEditor.id] && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await mapRequest("/" + mapEditor.id, {
                          method: "DELETE",
                          body: "{}",
                        });
                        setMaps((old) => {
                          const next = { ...old };
                          delete next[mapEditor.id];
                          return next;
                        });
                        setMapEditor(null);
                        onNotify("Карта отключена.");
                      } catch (e) {
                        onNotify((e as Error).message);
                      }
                    }}
                  >
                    Отключить карту
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
      {image && (
        <div
          className="reference-overlay image-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImage(null);
          }}
        >
          <section
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Скриншот улова"
          >
            <button
              aria-label="Закрыть скриншот"
              onClick={() => setImage(null)}
            >
              <X size={22} />
            </button>
            <img src={image} alt="Скриншот улова в полном размере" />
          </section>
        </div>
      )}
    </div>
  );
}
