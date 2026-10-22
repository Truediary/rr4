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

type Water = {
  id: string;
  name: string;
  level: number;
  kind: string;
  accent: string;
};
type MapConfig = {
  url: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  flipY: boolean;
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

function FishPicture({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      className={`fish-picture fish-picture-${variant % 4}`}
      viewBox="0 0 130 48"
      role="img"
      aria-label="Иллюстрация рыбы"
    >
      <defs>
        <linearGradient id={`fish-tone-${variant % 4}`} x2="0" y2="1">
          <stop stopColor="#65776e" />
          <stop offset=".45" stopColor="#a8b4a0" />
          <stop offset=".7" stopColor="#d5d5b6" />
          <stop offset="1" stopColor="#858b77" />
        </linearGradient>
      </defs>
      <path d="M27 24L5 8l4 16-4 15 22-13" fill="#7f8977" stroke="#616e65" />
      <path
        d="M24 24C40 9 78 9 108 19l15 6-16 7C76 44 43 38 24 24Z"
        fill={`url(#fish-tone-${variant % 4})`}
        stroke="#6d776a"
      />
      <path
        d="M47 14l18-12 16 12M55 34l9 11 14-9"
        fill="#8c9580"
        stroke="#79836f"
      />
      <path
        d="M39 21l55 4M44 29l42 2"
        stroke="#dbe1c7"
        strokeWidth=".8"
        opacity=".7"
      />
      <path d="M99 19q-7 9-1 15" fill="none" stroke="#727e6e" />
      <circle cx="109" cy="22" r="2" fill="#2d3e38" />
      <circle cx="109.5" cy="21.5" r=".7" fill="white" />
    </svg>
  );
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
              <FishPicture variant={i} />
            ) : kind === "bait" ? (
              <span className={`bait-mini bait-${i % 5}`}>
                <Anchor size={12} />
              </span>
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

function Terrain({
  id,
  sea,
  river,
}: {
  id: string;
  sea: boolean;
  river: boolean;
}) {
  const waterPath = river
    ? "M100-40Q510 40 170 155T410 330 210 600L365 600Q650 405 360 290T350 130 300-40Z"
    : sea
      ? "M310-20Q230 40 310 100T235 215 310 340 200 520L620 620V-20Z"
      : "M149 83Q237 16 350 91T473 201 419 303 453 421 280 495 170 418 102 320 132 202 149 83Z";
  return (
    <svg viewBox="0 0 600 600" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern
          id={`${id}-paper`}
          width="17"
          height="17"
          patternUnits="userSpaceOnUse"
        >
          <path d="M2 4l1-1m8 10h1" stroke="#7c7d5b" opacity=".2" />
        </pattern>
        <pattern
          id={`${id}-grid`}
          width="60"
          height="60"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M60 0H0V60"
            fill="none"
            stroke="#5a654a"
            strokeWidth=".8"
            opacity=".5"
          />
        </pattern>
        <filter id={`${id}-grain`}>
          <feTurbulence
            baseFrequency=".7"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".10" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <g filter={`url(#${id}-grain)`}>
        <path d="M0 0h600v600H0z" fill="#bdbb94" />
        <g fill="#899777" opacity=".45">
          <path d="M0 20Q90 100 80 240T50 600H0z" />
          <path d="M530 0Q455 100 510 210T560 490L600 600V0z" />
          <path d="M0 460Q100 360 270 470T600 480v120H0z" />
        </g>
        <g fill="none" stroke="#999d75" strokeWidth="2">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${i * 9 - 30} 80Q160 ${80 + i * 17} 280 ${27 + i * 13}T640 ${55 + i * 14}`}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M0 ${480 + i * 12}Q200 ${420 + i * 18} 330 ${490 + i * 14}T630 ${450 + i * 14}`}
            />
          ))}
        </g>
        <path
          d={waterPath}
          fill={sea ? "#5d8d9c" : "#718e81"}
          stroke="#8a9984"
          strokeWidth="12"
        />
        <path
          d={waterPath}
          fill={sea ? "#6996a6" : "#739288"}
          stroke="#667d70"
          strokeWidth="2"
        />
        <path
          d={waterPath}
          fill="none"
          stroke={sea ? "#40778c" : "#547971"}
          strokeWidth="1"
        />
        <path
          d={
            sea
              ? "M420 0Q275 200 470 340T410 650"
              : river
                ? "M290-40Q490 20 280 160T430 340 340 640"
                : "M227 146Q420 100 388 269T280 406 201 275 227 146Z"
          }
          fill="none"
          stroke={sea ? "#3d7188" : "#4e7b72"}
          strokeWidth={sea ? 65 : river ? 23 : 35}
          opacity=".45"
        />
        <path
          d="M-10 110Q80 80 97 265T45 610M508-30Q470 40 520 140T565 640"
          fill="none"
          stroke="#d3c8a1"
          strokeWidth="7"
        />
        <path
          d="M-10 110Q80 80 97 265T45 610M508-30Q470 40 520 140T565 640"
          fill="none"
          stroke="#807d60"
          strokeDasharray="5 6"
          strokeWidth="1"
        />
        <path d="M0 0h600v600H0z" fill={`url(#${id}-paper)`} />
        <path d="M0 0h600v600H0z" fill={`url(#${id}-grid)`} />
        <g fill="#435d59" opacity=".65" fontSize="9" fontFamily="serif">
          <text x="245" y="240">
            {sea ? "218" : "6,5"}
          </text>
          <text x="320" y="350">
            {sea ? "360" : "4,2"}
          </text>
          <text x="180" y="370">
            {sea ? "128" : "3,0"}
          </text>
        </g>
        <g fontFamily="serif" fontSize="9" fill="#4d533f">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <g key={i}>
              <text x={i * 60 - 4} y="12">
                {i * 20}
              </text>
              <text x="4" y={i * 60}>
                {i * 20}
              </text>
            </g>
          ))}
        </g>
      </g>
    </svg>
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
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const groups = groupReports(reports, "point");
  useEffect(() => {
    setReady(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [map?.url]);
  const xs = reports.map((r) => r.x),
    ys = reports.map((r) => r.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  function position(r: FishingReport) {
    if (map && ready) {
      const x = ((r.x - map.minX) / (map.maxX - map.minX)) * 100;
      const y = ((r.y - map.minY) / (map.maxY - map.minY)) * 100;
      return { x, y: map.flipY ? 100 - y : y };
    }
    return {
      x:
        r.mapX ?? (maxX > minX ? 18 + ((r.x - minX) / (maxX - minX)) * 64 : 50),
      y:
        r.mapY ?? (maxY > minY ? 18 + ((r.y - minY) / (maxY - minY)) * 64 : 50),
    };
  }
  const summary = summarize(reports);
  return (
    <article className="water-stat-card" data-water={water.id}>
      <header>
        <button
          className="water-name"
          onClick={() => onPoint("water:" + water.id)}
        >
          {water.name}
        </button>
        <button
          className="water-info-button"
          onClick={onConfigure}
          title="Изображение и координаты карты"
        >
          О водоёме
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
        Посты: <b>{summary.posts}</b> Улов: <b>{summary.catches}</b>{" "}
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
          <Terrain
            id={water.id}
            sea={water.kind === "Море"}
            river={water.kind === "Река"}
          />
          {map && (
            <img
              className={`real-water-map ${ready ? "ready" : ""}`}
              src={map.url}
              alt={`Карта: ${water.name}`}
              onLoad={() => setReady(true)}
              onError={() => setReady(false)}
              draggable={false}
            />
          )}
          <span className="map-water-label">{water.name}</span>
          {groups.map((g) => {
            const p = position(g.report);
            if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return null;
            return (
              <button
                key={g.key}
                className={`cluster-marker ${g.posts >= 3 ? "red" : g.posts >= 2 ? "yellow" : "green"}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                aria-label={`${water.name}, точка ${g.label}: ${g.posts} постов`}
                onClick={() => onPoint(g.key)}
              >
                <span>{g.posts > 1 ? g.posts : ""}</span>
              </button>
            );
          })}
        </div>
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
        <span className="map-status-badge">
          {map && ready ? "Карта пользователя" : "УСЛОВНАЯ СХЕМА"}
        </span>
        <span className="map-caption">
          {map && !ready
            ? "Изображение карты недоступно · показана схема"
            : map && ready
              ? "Метки по настроенной координатной сетке"
              : "Расположение меток условное"}
        </span>
        {!reports.length && (
          <span className="no-map-data">Нет отчётов за выбранный период</span>
        )}
      </div>
    </article>
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
            <FishPicture variant={report.fish.length} />
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
}: {
  reports: FishingReport[];
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
  const [view, setView] = useState("maps");
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
    setSavingMap(true);
    try {
      const config = await mapRequest("/" + mapEditor.id, {
        method: "PUT",
        body: JSON.stringify({
          url: form.get("url"),
          minX: Number(form.get("minX")),
          maxX: Number(form.get("maxX")),
          minY: Number(form.get("minY")),
          maxY: Number(form.get("maxY")),
          flipY: form.get("flipY") === "on",
        }),
      });
      setMaps((old) => ({ ...old, [mapEditor.id]: config }));
      setMapEditor(null);
      onNotify("Карта и координатная сетка сохранены.");
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
          <h1>Точки клёва и статистика</h1>
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
                    key={water.id}
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
                Подключите изображение, которое разрешено использовать, и
                укажите координаты его краёв. Настройка общая для всех
                посетителей этого экземпляра сайта.
              </p>
              <label>
                Адрес изображения
                <input
                  name="url"
                  required
                  defaultValue={maps[mapEditor.id]?.url || ""}
                  placeholder="https://example.com/map.jpg или /maps/map.jpg"
                />
              </label>
              <div className="map-bounds">
                {[
                  ["minX", "X слева", 0],
                  ["maxX", "X справа", 300],
                  ["minY", "Минимальная Y", 0],
                  ["maxY", "Максимальная Y", 300],
                ].map(([name, label, fallback]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={String(name)}
                      type="number"
                      step="any"
                      required
                      defaultValue={
                        maps[mapEditor.id]?.[
                          name as "minX" | "maxX" | "minY" | "maxY"
                        ] ?? fallback
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="map-flip">
                <input
                  type="checkbox"
                  name="flipY"
                  defaultChecked={maps[mapEditor.id]?.flipY ?? true}
                />
                Y растёт снизу вверх
              </label>
              <p className="map-editor-note">
                Пока изображение не подключено, используется условная схема.
                Исходные игровые карты в проект не включены.
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
                    Вернуть схему
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
