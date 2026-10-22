import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Fish,
  Waves,
  MapPin,
  Compass,
  Layers,
  Bookmark,
  ArrowUpRight,
  ArrowRight,
  Search,
  ChevronDown,
  Plus,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Clock3,
  ExternalLink,
  RefreshCw,
  Link2,
  Check,
  Info,
  Navigation,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Anchor,
  Flame,
  ChevronRight,
  Menu,
  Trash2,
  Database,
  CircleHelp,
  Copy,
} from "lucide-react";
import "./style.css";

type Water = {
  id: string;
  name: string;
  level: number;
  kind: string;
  accent: string;
};
type Report = {
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
};
type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  checkedAt: string | null;
  status: string | null;
};
type Page = "spots" | "waters" | "sources" | "favorites";
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось загрузить данные");
  return data;
}
const timeAgo = (date: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 60000),
  );
  return minutes < 1
    ? "только что"
    : minutes < 60
      ? `${minutes} мин назад`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} ч назад`
        : `${Math.floor(minutes / 1440)} дн назад`;
};
function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem("klev-favorites") || "[]").filter(
      (v: unknown) => typeof v === "string",
    );
  } catch {
    return [];
  }
}

function Landscape({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "landscape small" : "landscape"}
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#537c86" />
          <stop offset="1" stopColor="#a6b5a5" />
        </linearGradient>
        <linearGradient id="lake" x2="0" y2="1">
          <stop stopColor="#5b8589" />
          <stop offset="1" stopColor="#153c4e" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".7"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".09" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="soft-light" />
        </filter>
      </defs>
      <g filter="url(#grain)">
        <path fill="url(#sky)" d="M0 0h1200v300H0z" />
        <circle cx="930" cy="52" r="39" fill="#dbd2ab" opacity=".5" />
        <path
          fill="#6b8b82"
          d="M0 110L150 51 299 111 450 75 610 110 850 40 1090 101 1200 60v240H0z"
        />
        <path
          fill="#446e68"
          d="M0 124L133 90 256 133 500 109 679 135 866 83 1038 107 1200 80v220H0z"
        />
        <path fill="url(#lake)" d="M0 150Q290 128 510 158T1200 123v177H0z" />
        <path
          fill="#214d46"
          d="M0 96q140 21 269 67l-120 27L0 183zM1200 108q-160-13-280 60l130 30 150-10z"
        />
        {Array.from({ length: 33 }, (_, i) => {
          const x = i * 42;
          const y = 110 + Math.sin(i) * 11;
          return (
            <g
              key={i}
              fill={i < 8 ? "#21493e" : "#294f43"}
              opacity={i > 8 && i < 23 ? 0.45 : 1}
            >
              <path d={`M${x} ${y - 55}l-13 35h7l-17 29h46l-17-29h7z`} />
              <path d={`M${x - 2} ${y - 3}h4v19h-4z`} />
            </g>
          );
        })}
        <path
          d="M420 193h350M540 204h360M310 229h420M670 251h410M502 275h290"
          stroke="#acc1b1"
          strokeWidth="1"
          opacity=".15"
        />
        <path fill="#102f2d" d="M0 245q110-43 248 13l157 42H0z" />
        <path
          d="M1140 295l-20-85m13 52l-20-15m13-13l12-20M80 300l10-61m-7 39l-12-13"
          stroke="#143b32"
          strokeWidth="4"
        />
      </g>
    </svg>
  );
}

function LakeMap({
  reports,
  selected,
  onSelect,
  water,
}: {
  reports: Report[];
  selected: string | null;
  onSelect: (id: string) => void;
  water?: Water;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="map-shell">
      <div className="map-top">
        <span>
          <MapPin size={15} />
          {water?.name || "Выберите водоём"}
        </span>
        <span className="map-label">СХЕМА ВОДОЁМА</span>
      </div>
      <div className="map-canvas">
        <div className="map-inner" style={{ transform: `scale(${zoom})` }}>
          <svg
            viewBox="0 0 800 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="terrain"
                width="35"
                height="35"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="8" cy="12" r="1" fill="#9fae8d" opacity=".25" />
                <path d="M24 20l-3 5h6z" fill="#8eaa87" opacity=".25" />
              </pattern>
              <pattern
                id="water"
                width="22"
                height="18"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M2 9q5-3 10 0"
                  fill="none"
                  stroke="#9bc5c6"
                  strokeWidth=".7"
                  opacity=".3"
                />
              </pattern>
              <filter id="blur">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <path fill="#dee2cd" d="M0 0h800v500H0z" />
            <path fill="url(#terrain)" d="M0 0h800v500H0z" />
            <g fill="none" stroke="#c9d0b7" strokeWidth="1.5">
              <path d="M-30 180Q80 30 250 68T500 15 810 90" />
              <path d="M-20 198Q90 53 251 85T500 32 810 109" />
              <path d="M-20 215Q90 70 250 102T500 49 810 128" />
              <path d="M0 440Q130 365 250 420T490 430 820 365" />
              <path d="M0 459Q130 383 250 438T490 449 820 384" />
              <path d="M550 0q-60 110 160 160t80 200" />
            </g>
            <path
              d="M-20 116Q125 130 141 241T106 500M570-10Q530 100 670 198T811 272"
              fill="none"
              stroke="#f2e9cb"
              strokeWidth="9"
            />
            <path
              d="M-20 116Q125 130 141 241T106 500M570-10Q530 100 670 198T811 272"
              fill="none"
              stroke="#c7b999"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <path
              d="M227 87C298 33 341 110 408 94S474 53 529 118 610 150 641 207 590 296 602 353 500 405 460 381 389 434 337 398 227 393 211 335 169 286 199 226 169 130 227 87Z"
              fill="#bfd4ce"
              stroke="#b2c7b2"
              strokeWidth="13"
            />
            <path
              d="M227 87C298 33 341 110 408 94S474 53 529 118 610 150 641 207 590 296 602 353 500 405 460 381 389 434 337 398 227 393 211 335 169 286 199 226 169 130 227 87Z"
              fill="#a8cdcf"
              stroke="#92b7b4"
              strokeWidth="2"
            />
            <path d="M0 0h800v500H0z" fill="url(#water)" opacity=".3" />
            <path
              d="M296 173Q411 119 526 191T518 332 349 336 296 173Z"
              fill="none"
              stroke="#84b6bc"
              strokeWidth="1"
              opacity=".6"
            />
            <path
              d="M336 202Q410 165 488 214T475 306 370 301 336 202Z"
              fill="#92bec4"
              opacity=".45"
            />
            <path
              d="M351 228q55-46 107 5t-17 59-90-64z"
              fill="none"
              stroke="#81afb8"
              opacity=".6"
            />
            <path
              d="M421 142l15-9 17 8-7 13-19 3z"
              fill="#d2dbc0"
              stroke="#95b1a0"
            />
            <g fill="#85a37c" opacity=".6">
              {Array.from({ length: 45 }, (_, i) => (
                <circle
                  key={i}
                  cx={i < 23 ? 40 + (i % 7) * 17 : 665 + (i % 6) * 19}
                  cy={50 + (i % 17) * 26}
                  r={7 + (i % 6)}
                />
              ))}
            </g>
            <g fontFamily="sans-serif" fill="#789aa0" fontSize="12">
              <text x="410" y="269">
                6,5 м
              </text>
              <text x="297" y="198">
                3 м
              </text>
              <text x="519" y="322">
                2 м
              </text>
            </g>
            <text x="85" y="405" fill="#8e987c" fontSize="11" letterSpacing="3">
              ЛЕСНАЯ ТРОПА
            </text>
            <g transform="translate(176 325)">
              <rect width="16" height="12" fill="#a88d6d" />
              <path d="M-3 0L8-10 19 0" fill="#8c765a" />
            </g>
          </svg>
          {reports.map((r, i) => (
            <button
              key={r.id}
              className={`map-pin ${selected === r.id ? "active" : ""}`}
              style={{
                left: `${r.mapX ?? 30 + (r.x % 40)}%`,
                top: `${r.mapY ?? 25 + (r.y % 45)}%`,
              }}
              onClick={() => onSelect(r.id)}
              title={`${r.fish} · ${r.x}:${r.y}`}
              aria-label={`Точка ${r.x}:${r.y}, ${r.fish}`}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="map-compass">
          <Navigation size={20} />
          <span>С</span>
        </div>
        <div className="map-zoom">
          <button
            aria-label="Увеличить карту"
            onClick={() => setZoom((v) => Math.min(1.8, v + 0.2))}
          >
            <Plus size={17} />
          </button>
          <button
            aria-label="Уменьшить карту"
            onClick={() => setZoom((v) => Math.max(1, v - 0.2))}
          >
            <ZoomOut size={17} />
          </button>
          <button aria-label="Сбросить масштаб" onClick={() => setZoom(1)}>
            <Crosshair size={17} />
          </button>
        </div>
        <span className="map-disclaimer">
          Схема · расположение меток условное
        </span>
        <span className="map-scale">100 м ━━━</span>
      </div>
      <div className="map-bottom">
        <span>
          <i className="dot blue" />
          Точки из списка: {reports.length}
        </span>
        <span>Нажмите на метку, чтобы увидеть снасти</span>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>("spots");
  const [waters, setWaters] = useState<Water[]>([]);
  const [fishCatalog, setFishCatalog] = useState<string[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [demo, setDemo] = useState(true);
  const [water, setWater] = useState("old-burg");
  const [fish, setFish] = useState("");
  const [tackle, setTackle] = useState("");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("fresh");
  const [layout, setLayout] = useState("grid");
  const [selected, setSelected] = useState<string | null>("demo-0");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [modal, setModal] = useState<"report" | "source" | "about" | null>(
    null,
  );
  const [detail, setDetail] = useState<Report | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [realCount, setRealCount] = useState(0);
  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 4500);
  };
  const refreshSources = () => api<Source[]>("/sources").then(setSources);
  useEffect(() => {
    api<{ waters: Water[]; fish: string[] }>("/catalog")
      .then((c) => {
        setWaters(c.waters);
        setFishCatalog(c.fish);
      })
      .catch((e) => setError(e.message));
    refreshSources().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api<Report[]>(`/reports?demo=${demo}`)
      .then((r) => {
        if (live) {
          setReports(r);
          setSelected(r[0]?.id ?? null);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    api<Report[]>("/reports")
      .then((r) => {
        if (live) setRealCount(r.length);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [demo]);
  useEffect(() => {
    try {
      localStorage.setItem("klev-favorites", JSON.stringify(favorites));
    } catch {
      /* Storage may be disabled. */
    }
  }, [favorites]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setDetail(null);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!modal && !detail) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("input, select, button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select, textarea",
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal, detail]);
  const filtered = useMemo(
    () =>
      reports
        .filter(
          (r) =>
            (!water || r.waterId === water) &&
            (!fish || r.fish === fish) &&
            (!tackle || r.tackle === tackle) &&
            (period === "all" ||
              Date.now() - Date.parse(r.publishedAt) <
                Number(period) * 3600000) &&
            `${r.fish} ${r.bait} ${r.x}:${r.y} ${r.author}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (page !== "favorites" || favorites.includes(r.id)),
        )
        .sort((a, b) =>
          sort === "catches"
            ? b.catches - a.catches
            : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
        ),
    [reports, water, fish, tackle, period, query, page, favorites, sort],
  );
  const currentWater = waters.find((w) => w.id === water);
  const active = filtered.find((r) => r.id === selected) ?? filtered[0];
  const toggleFavorite = (id: string) =>
    setFavorites((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const changePage = (next: Page) => {
    setPage(next);
    setMenu(false);
    if (next === "favorites") setWater("");
  };
  const reset = () => {
    setWater("");
    setFish("");
    setTackle("");
    setQuery("");
    setPeriod("all");
  };
  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const body = {
        waterId: form.get("waterId"),
        fish: form.get("fish"),
        x: Number(form.get("x")),
        y: Number(form.get("y")),
        bait: form.get("bait"),
        tackle: form.get("tackle"),
        author: form.get("author"),
        weight: form.get("weight"),
        catches: Number(form.get("catches")),
        note: form.get("note"),
        sourceUrl: form.get("sourceUrl") || null,
      };
      await api("/reports", { method: "POST", body: JSON.stringify(body) });
      setDemo(false);
      setPage("spots");
      setWater(String(body.waterId));
      setFish("");
      setTackle("");
      setQuery("");
      setPeriod("all");
      if (!demo) setReports(await api("/reports"));
      setRealCount((v) => v + 1);
      setModal(null);
      notify("Отчёт сохранён. Спасибо, что делитесь точками!");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveSource({
      name: String(form.get("name")),
      url: String(form.get("url")),
      type: String(form.get("type")),
    });
  }
  async function saveSource(source: {
    name: string;
    url: string;
    type: string;
  }) {
    setBusy(true);
    try {
      await api("/sources", { method: "POST", body: JSON.stringify(source) });
      await refreshSources();
      setModal(null);
      notify(
        source.type === "website"
          ? "Источник сохранён. Автосбор для сайта ещё не подключён."
          : "Источник добавлен. Нажмите «Обновить», чтобы загрузить отчёты.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function syncSource(source: Source) {
    setSyncing(source.id);
    try {
      const result = await api<{
        imported: number;
        skipped: number;
        duplicates: number;
      }>(`/sources/${source.id}/sync`, { method: "POST", body: "{}" });
      notify(
        `Добавлено: ${result.imported}. Пропущено: ${result.skipped}. Дубликатов: ${result.duplicates}.`,
      );
      if (!demo) setReports(await api("/reports"));
      setRealCount((await api<Report[]>("/reports")).length);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      await refreshSources();
      setSyncing(null);
    }
  }
  const nav = [
    { id: "spots" as Page, icon: MapPin, label: "Точки клёва" },
    { id: "waters" as Page, icon: Waves, label: "Водоёмы" },
    { id: "sources" as Page, icon: Layers, label: "Источники" },
    { id: "favorites" as Page, icon: Bookmark, label: "Избранное" },
  ];
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changePage("spots");
          }}
        >
          <span className="brand-symbol">
            <Fish size={29} />
          </span>
          <span>
            клёв<span className="brand-dot">.</span>
            <small>РУССКАЯ РЫБАЛКА 4</small>
          </span>
        </a>
        <div className="nav-caption">НАВИГАЦИЯ</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item active" : "nav-item"}
              onClick={() => changePage(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "favorites" && favorites.length > 0 && (
                <b>{favorites.length}</b>
              )}
              {n.id === "spots" && <span className="nav-new">LIVE</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <div className="nav-caption">
          ВАШИ ИСТОЧНИКИ <Link2 size={13} />
        </div>
        <a
          className="sidebar-source"
          href="https://www.rf4-stat.ru/"
          target="_blank"
          rel="noreferrer"
        >
          <span className="source-avatar">R</span>
          <span>
            RF4 STAT<small>Сайт сообщества</small>
          </span>
          <ArrowUpRight size={15} />
        </a>
        <a
          className="sidebar-source"
          href="https://vk.ru/pp4wikipedia"
          target="_blank"
          rel="noreferrer"
        >
          <span className="source-avatar vk">vk</span>
          <span>
            РР4 Википедия<small>Сообщество ВКонтакте</small>
          </span>
          <ArrowUpRight size={15} />
        </a>
        <button
          className="add-source-nav"
          onClick={() => {
            changePage("sources");
            setModal("source");
          }}
        >
          <Plus size={15} />
          Добавить источник
        </button>
        <div className="sidebar-bottom">
          <div className="community-icon">
            <Compass size={27} />
          </div>
          <strong>
            Хорошая рыбалка
            <br />
            начинается с точки.
          </strong>
          <p>
            Сохраняйте находки.
            <br />
            Делитесь опытом.
          </p>
          <button onClick={() => setModal("about")}>
            О проекте <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-footer">
            Неофициальный проект РР4<span>v 0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              onClick={() => setMenu(!menu)}
              aria-label="Открыть меню"
            >
              <Menu size={21} />
            </button>
            <span>Навигатор рыболова</span>
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="help-link" onClick={() => setModal("about")}>
              <CircleHelp size={16} />
              Как это работает
            </button>
            <span className="topbar-divider" />
            <span className="user-avatar">Р</span>
          </div>
        </header>
        <main>
          <section className="hero">
            <Landscape />
            <div className="hero-shade" />
            <div className="hero-content">
              <div className="hero-eyebrow">
                <span /> ВАШ ОРИЕНТИР В МИРЕ РР4
              </div>
              <h1>
                Найдите свою
                <br />
                точку клёва<span>.</span>
              </h1>
              <p>
                Водоёмы, снасти и опыт рыболовов —<br />
                всё, что нужно для следующего трофея.
              </p>
              <button
                className="hero-button"
                onClick={() => setModal("report")}
              >
                <Plus size={17} />
                Поделиться точкой
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="hero-location">
              <span className="hero-location-icon">
                <Waves size={22} />
              </span>
              <span>
                Место для новых историй<small>Русская рыбалка 4</small>
              </span>
            </div>
            <span className="hero-art-label">Иллюстрация</span>
          </section>
          <section className="stats">
            <div>
              <span className="stat-icon blue-soft">
                <MapPin size={20} />
              </span>
              <span>
                <small>
                  {demo ? "Точек в демокаталоге" : "Отчётов сообщества"}
                </small>
                <strong>
                  {demo ? reports.length : realCount}
                  <em>{demo ? "пример интерфейса" : "в базе"}</em>
                </strong>
              </span>
              {demo && (
                <svg
                  className="sparkline"
                  viewBox="0 0 80 25"
                  aria-hidden="true"
                >
                  <path d="M1 22L10 16 22 18 31 9 42 13 54 6 63 9 79 1" />
                </svg>
              )}
            </div>
            <div>
              <span className="stat-icon green-soft">
                <Waves size={20} />
              </span>
              <span>
                <small>Водоёмов в каталоге</small>
                <strong>
                  {waters.length}
                  <em>есть с чего начать</em>
                </strong>
              </span>
            </div>
            <div>
              <span className="stat-icon amber-soft">
                <Fish size={20} />
              </span>
              <span>
                <small>Видов рыб в фильтре</small>
                <strong>
                  {fishCatalog.length}
                  <em>мирные и хищные</em>
                </strong>
              </span>
            </div>
            <div>
              <span className="stat-icon violet-soft">
                <Layers size={20} />
              </span>
              <span>
                <small>Источников с загрузкой</small>
                <strong>
                  {
                    sources.filter((s) => s.status?.startsWith("Добавлено:"))
                      .length
                  }
                  <em>{sources.length} сохранено</em>
                </strong>
              </span>
            </div>
          </section>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => window.location.reload()}>
                Повторить
              </button>
            </div>
          )}
          <div className="demo-banner">
            <Info size={16} />
            <span>
              {demo ? (
                <>
                  <strong>Режим знакомства.</strong> Точки и уловы вымышлены.
                  Реальные отчёты доступны в режиме сообщества.
                </>
              ) : (
                <>
                  <strong>Отчёты сообщества.</strong>{" "}
                  {realCount
                    ? "Уловы добавлены пользователями или импортированы из источников."
                    : "Поделитесь первой точкой или подключите открытый источник."}
                </>
              )}
            </span>
            <button
              role="switch"
              aria-checked={demo}
              aria-label="Демонстрационные данные"
              className={`switch ${demo ? "on" : ""}`}
              onClick={() => setDemo(!demo)}
            >
              <i />
            </button>
            <span className="demo-toggle-label">Демо</span>
          </div>
          {(page === "spots" || page === "favorites") && (
            <>
              <div className="section-heading">
                <div>
                  <div className="section-eyebrow">
                    {page === "favorites"
                      ? "ЛИЧНАЯ КОЛЛЕКЦИЯ"
                      : "ИССЛЕДУЙТЕ. ВЫБИРАЙТЕ. ЛОВИТЕ."}
                  </div>
                  <h2>
                    {page === "favorites" ? "Избранные точки" : "Точки клёва"}
                    <span>{filtered.length}</span>
                  </h2>
                </div>
                <div className="heading-meta">
                  <span className="dot green" />
                  {demo ? "Демонстрационный каталог" : "Сохранённые отчёты"}
                  <button onClick={() => setModal("report")}>
                    <Plus size={15} />
                    Добавить точку
                  </button>
                </div>
              </div>
              <div className="filters">
                <label>
                  <span>Водоём</span>
                  <div>
                    <Waves size={17} />
                    <select
                      value={water}
                      onChange={(e) => {
                        setWater(e.target.value);
                        setSelected(null);
                      }}
                      aria-label="Водоём"
                    >
                      <option value="">Все водоёмы</option>
                      {waters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <label>
                  <span>Рыба</span>
                  <div>
                    <Fish size={17} />
                    <select
                      value={fish}
                      onChange={(e) => setFish(e.target.value)}
                      aria-label="Рыба"
                    >
                      <option value="">Любая рыба</option>
                      {Array.from(
                        new Set([
                          ...fishCatalog,
                          ...reports.map((r) => r.fish),
                        ]),
                      ).map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <label>
                  <span>Снасть</span>
                  <div>
                    <Anchor size={17} />
                    <select
                      value={tackle}
                      onChange={(e) => setTackle(e.target.value)}
                      aria-label="Снасть"
                    >
                      <option value="">Любая снасть</option>
                      {["Донная", "Поплавочная", "Спиннинговая"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <label>
                  <span>Период</span>
                  <div>
                    <Clock3 size={16} />
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      aria-label="Период"
                    >
                      <option value="all">За всё время</option>
                      <option value="1">За час</option>
                      <option value="24">За сутки</option>
                      <option value="168">За неделю</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <button
                  className="reset-filters"
                  title="Сбросить фильтры"
                  aria-label="Сбросить фильтры"
                  onClick={reset}
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
              <div className="results-bar">
                <div className="search-input">
                  <Search size={16} />
                  <input
                    placeholder="Рыба, наживка или координаты"
                    aria-label="Поиск точек"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Очистить поиск"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="sort-controls">
                  <select
                    aria-label="Сортировка"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="fresh">Сначала свежие</option>
                    <option value="catches">По количеству уловов</option>
                  </select>
                  <div className="view-switch">
                    <button
                      aria-label="Карточки"
                      className={layout === "grid" ? "active" : ""}
                      onClick={() => setLayout("grid")}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      aria-label="Список"
                      className={layout === "list" ? "active" : ""}
                      onClick={() => setLayout("list")}
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="workspace-grid">
                <section
                  className={`reports ${layout === "list" ? "list-view" : ""}`}
                >
                  {loading ? (
                    <div className="empty-state">
                      <RefreshCw className="spin" />
                      Загружаем точки…
                    </div>
                  ) : filtered.length ? (
                    filtered.map((r, i) => (
                      <article
                        key={r.id}
                        className={`report-card ${active?.id === r.id ? "selected" : ""}`}
                        onClick={() => setSelected(r.id)}
                      >
                        <div className="report-card-top">
                          <span className={`fish-icon fish-tone-${i % 3}`}>
                            <Fish size={26} />
                          </span>
                          <div className="report-title">
                            <h3>{r.fish}</h3>
                            <span>
                              {waters.find((w) => w.id === r.waterId)?.name}
                            </span>
                          </div>
                          <button
                            className={`favorite-button ${favorites.includes(r.id) ? "saved" : ""}`}
                            aria-label={`${favorites.includes(r.id) ? "Убрать из избранного" : "В избранное"}: ${r.fish}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(r.id);
                            }}
                          >
                            <Bookmark
                              size={17}
                              fill={
                                favorites.includes(r.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </div>
                        <div className="coordinate-row">
                          <span className="coordinates">
                            <MapPin size={15} />
                            {r.x}:{r.y}
                          </span>
                          <span className="tackle-badge">{r.tackle}</span>
                          {r.catches >= 15 && (
                            <span className="hot-badge">
                              <Flame size={12} />
                            </span>
                          )}
                        </div>
                        <div className="bait-row">
                          <span>Наживка</span>
                          <strong>{r.bait}</strong>
                        </div>
                        <div className="catch-row">
                          <span>
                            <Fish size={14} />
                            <b>{r.catches}</b> уловов
                          </span>
                          {r.weight && (
                            <span>
                              до <b>{r.weight}</b>
                            </span>
                          )}
                          <span className="catch-bars" aria-hidden="true">
                            {[3, 5, 4, 7, 6, 9, 8, 11, 9, 13].map((v, k) => (
                              <i key={k} style={{ height: `${v}px` }} />
                            ))}
                          </span>
                        </div>
                        <div className="report-footer">
                          <span>
                            <i className={`dot ${r.demo ? "amber" : "blue"}`} />
                            {r.demo ? "Демо" : r.sourceName}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(r);
                            }}
                          >
                            {timeAgo(r.publishedAt)}
                            <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <MapPin size={32} />
                      <h3>
                        {page === "favorites"
                          ? "Здесь будут ваши находки"
                          : "Пока нет подходящих точек"}
                      </h3>
                      <p>
                        {page === "favorites"
                          ? "Нажмите на закладку в карточке, чтобы сохранить точку."
                          : "Измените фильтры или поделитесь своим отчётом."}
                      </p>
                      <button
                        className="primary-button"
                        onClick={
                          page === "favorites"
                            ? () => changePage("spots")
                            : () => setModal("report")
                        }
                      >
                        {page === "favorites"
                          ? "Найти точки"
                          : "Добавить точку"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <aside className="map-column">
                  <LakeMap
                    reports={water ? filtered : []}
                    selected={active?.id ?? null}
                    water={currentWater}
                    onSelect={setSelected}
                  />
                  {!water && (
                    <div className="map-note">
                      <Info size={15} />
                      Выберите водоём, чтобы увидеть точки на схеме.
                    </div>
                  )}
                  {active && (
                    <div className="selected-point">
                      <div className="selected-point-heading">
                        <span>
                          <span className="dot blue" />
                          ВЫБРАННАЯ ТОЧКА
                        </span>
                        <button onClick={() => setDetail(active)}>
                          Подробнее
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                      <div className="selected-point-content">
                        <span className="point-number">
                          {filtered.findIndex((r) => r.id === active.id) + 1}
                        </span>
                        <div>
                          <h3>
                            {active.fish}
                            <span>
                              {active.x}:{active.y}
                            </span>
                          </h3>
                          <p>
                            {active.bait} <span>·</span> {active.tackle}
                          </p>
                        </div>
                        <button
                          aria-label="Скопировать координаты"
                          onClick={() =>
                            navigator.clipboard
                              ?.writeText(`${active.x}:${active.y}`)
                              .then(() => notify("Координаты скопированы"))
                              .catch(() =>
                                notify(`Координаты: ${active.x}:${active.y}`),
                              )
                          }
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="tip-card">
                    <span className="tip-icon">
                      <Compass size={21} />
                    </span>
                    <div>
                      <strong>Клёв — дело переменчивое</strong>
                      <p>
                        Смотрите на дату отчёта. Погода, время суток и прикормка
                        влияют на результат.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === "waters" && (
            <>
              <div className="section-heading">
                <div>
                  <div className="section-eyebrow">
                    ОТ ПЕРВОЙ РЫБЫ ДО ТРОФЕЯ
                  </div>
                  <h2>
                    Водоёмы<span>{waters.length}</span>
                  </h2>
                </div>
                <p className="subtle">Выберите место для следующей рыбалки</p>
              </div>
              <div className="waters-grid">
                {waters.map((w, i) => (
                  <button
                    key={w.id}
                    className="water-card"
                    onClick={() => {
                      setWater(w.id);
                      setPage("spots");
                      setFish("");
                      setTackle("");
                      setQuery("");
                    }}
                  >
                    <div className={`water-art water-art-${i % 4}`}>
                      <Landscape small />
                      <span>УРОВЕНЬ {w.level}+</span>
                      <div className="water-art-symbol">
                        <Waves size={37} />
                      </div>
                    </div>
                    <div className="water-card-info">
                      <span>{w.kind}</span>
                      <h3>{w.name}</h3>
                      <p>
                        {reports.filter((r) => r.waterId === w.id).length}{" "}
                        {demo ? "демоточек" : "отчётов"}
                        <ArrowRight size={18} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "sources" && (
            <>
              <div className="section-heading">
                <div>
                  <div className="section-eyebrow">
                    ДАННЫЕ С УКАЗАНИЕМ ПРОИСХОЖДЕНИЯ
                  </div>
                  <h2>
                    Источники<span>{sources.length}</span>
                  </h2>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setModal("source")}
                >
                  <Plus size={16} />
                  Добавить источник
                </button>
              </div>
              <div className="source-explainer">
                <Database size={25} />
                <div>
                  <h3>Каждая точка — с историей</h3>
                  <p>
                    RSS, JSON и VK API проверяются каждые 30 минут и по кнопке,
                    с удалением дубликатов. Для обычных сайтов нужен отдельный
                    адаптер или официальный API. Сохранённая ссылка сама по себе
                    не включает автосбор.
                  </p>
                </div>
              </div>
              <div className="recommended-sources">
                {[
                  {
                    name: "RF4 STAT",
                    url: "https://www.rf4-stat.ru/",
                    type: "website",
                    letter: "R",
                    description: "Статистика и точки сообщества РР4",
                  },
                  {
                    name: "РР4 Википедия",
                    url: "https://vk.ru/pp4wikipedia",
                    type: "vk",
                    letter: "vk",
                    description: "Сообщество ВКонтакте",
                  },
                ].map((s) => (
                  <div className="recommended-card" key={s.url}>
                    <span
                      className={`large-source-icon ${s.letter === "vk" ? "vk" : ""}`}
                    >
                      {s.letter}
                    </span>
                    <div>
                      <h3>{s.name}</h3>
                      <p>{s.description}</p>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        Открыть источник
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    {sources.some((x) => x.url === s.url) ? (
                      <span className="source-saved">
                        <Check size={15} />
                        Сохранён
                      </span>
                    ) : (
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() => saveSource(s)}
                      >
                        <Plus size={14} />
                        Сохранить
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="sources-table">
                {sources.length ? (
                  sources.map((s) => (
                    <div className="source-row" key={s.id}>
                      <span className="source-type-icon">
                        <Layers size={20} />
                      </span>
                      <div className="source-info">
                        <h3>
                          {s.name}
                          <span className="type-label">
                            {s.type === "website"
                              ? "Сайт"
                              : s.type.toUpperCase()}
                          </span>
                        </h3>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.url}
                          <ExternalLink size={12} />
                        </a>
                        <p
                          className={
                            s.status?.startsWith("Ошибка") ? "source-error" : ""
                          }
                        >
                          {s.status || "Ещё не загружен"}
                          {s.checkedAt && (
                            <span> · {timeAgo(s.checkedAt)}</span>
                          )}
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        disabled={syncing === s.id}
                        onClick={() => syncSource(s)}
                      >
                        <RefreshCw
                          size={14}
                          className={syncing === s.id ? "spin" : ""}
                        />
                        {s.type === "website" ? "Проверить" : "Обновить"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Удалить источник ${s.name}`}
                        onClick={async () => {
                          try {
                            await api(`/sources/${s.id}`, {
                              method: "DELETE",
                              body: "{}",
                            });
                            await refreshSources();
                            notify("Источник удалён. Его отчёты сохранены.");
                          } catch (e) {
                            notify((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Link2 size={29} />
                    <h3>Подключите первый источник</h3>
                    <p>
                      Сохраните выбранные сайты или добавьте RSS/JSON-ленту.
                    </p>
                  </div>
                )}
              </div>
              <div className="format-help">
                <h3>Как подготовить ленту?</h3>
                <p>
                  JSON: массив объектов с полями{" "}
                  <code>waterId, fish, x, y, bait, tackle</code>. RSS: название
                  водоёма, координаты <code>47:20</code> и поля{" "}
                  <code>Рыба: Линь | Наживка: Червь | Снасть: Донная</code>.
                  Подробный пример — в README проекта.
                </p>
                <p>
                  VK и другие закрытые площадки подключаются через разрешённые
                  API. Автоматический обход защиты не используется.
                </p>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>
              <Fish size={16} />
              клёв. <span>Собираем опыт. Находим своё.</span>
            </span>
            <span>
              Неофициальный навигатор «Русская рыбалка 4»
              <button onClick={() => setModal("about")}>
                О проекте
                <ArrowUpRight size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {(modal || detail) && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setDetail(null);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              detail
                ? "Подробности точки"
                : modal === "report"
                  ? "Добавить точку"
                  : modal === "source"
                    ? "Добавить источник"
                    : "О проекте"
            }
          >
            <button
              className="modal-close"
              aria-label="Закрыть"
              onClick={() => {
                setModal(null);
                setDetail(null);
              }}
            >
              <X size={20} />
            </button>
            {modal === "report" && (
              <>
                <span className="modal-symbol">
                  <MapPin size={25} />
                </span>
                <h2>Поделиться точкой</h2>
                <p className="modal-description">
                  Укажите свой реальный улов. Отчёт сохранится в базе
                  сообщества.
                </p>
                <form onSubmit={submitReport} className="form">
                  <label>
                    Водоём
                    <select
                      name="waterId"
                      defaultValue={water || "old-burg"}
                      required
                    >
                      {waters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Рыба
                    <input
                      name="fish"
                      list="fish-options"
                      placeholder="Например, Линь"
                      required
                      minLength={2}
                      maxLength={80}
                    />
                    <datalist id="fish-options">
                      {fishCatalog.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </label>
                  <div className="form-two">
                    <label>
                      Координата X
                      <input
                        name="x"
                        type="number"
                        placeholder="47"
                        required
                        min="0"
                        max="999"
                      />
                    </label>
                    <label>
                      Координата Y
                      <input
                        name="y"
                        type="number"
                        placeholder="20"
                        required
                        min="0"
                        max="999"
                      />
                    </label>
                  </div>
                  <div className="form-two">
                    <label>
                      Наживка
                      <input
                        name="bait"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Творожное тесто"
                      />
                    </label>
                    <label>
                      Снасть
                      <select name="tackle">
                        {["Донная", "Поплавочная", "Спиннинговая"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-two">
                    <label>
                      Количество уловов
                      <input
                        name="catches"
                        type="number"
                        defaultValue="1"
                        required
                        min="1"
                        max="10000"
                      />
                    </label>
                    <label>
                      Максимальный вес
                      <input
                        name="weight"
                        placeholder="4,8 кг"
                        maxLength={40}
                      />
                    </label>
                  </div>
                  <label>
                    Ваш ник
                    <input
                      name="author"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Как к вам обращаться?"
                    />
                  </label>
                  <label>
                    Ссылка на публикацию <span>необязательно</span>
                    <input
                      name="sourceUrl"
                      type="url"
                      placeholder="https://vk.ru/..."
                    />
                  </label>
                  <label>
                    Заметка <span>необязательно</span>
                    <textarea
                      name="note"
                      maxLength={2000}
                      placeholder="Дистанция, клипса, прикормка, время суток…"
                      rows={3}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Сохраняем…" : "Опубликовать отчёт"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              </>
            )}
            {modal === "source" && (
              <>
                <span className="modal-symbol">
                  <Layers size={25} />
                </span>
                <h2>Новый источник</h2>
                <p className="modal-description">
                  Для импорта нужна открытая RSS/Atom-лента или JSON с отчётами.
                  Обычный сайт можно сохранить как ссылку.
                </p>
                <form onSubmit={addSource} className="form">
                  <label>
                    Название
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Название сообщества"
                    />
                  </label>
                  <label>
                    Формат
                    <select name="type">
                      <option value="rss">RSS / Atom — импорт отчётов</option>
                      <option value="json">
                        JSON — структурированные отчёты
                      </option>
                      <option value="vk">
                        VK API — нужен токен в настройках окружения
                      </option>
                      <option value="website">
                        Сайт — сохранить ссылку, без автосбора
                      </option>
                    </select>
                  </label>
                  <label>
                    Публичный HTTPS-адрес
                    <input
                      name="url"
                      type="url"
                      pattern="https://.*"
                      required
                      placeholder="https://example.com/feed.xml"
                    />
                  </label>
                  <div className="inline-info">
                    <Info size={17} />
                    Не добавляйте токены и пароли в адрес. Источник должен
                    разрешать чтение публикаций.
                  </div>
                  <button
                    disabled={busy}
                    className="primary-button"
                    type="submit"
                  >
                    {busy ? "Проверяем…" : "Сохранить источник"}
                    <Plus size={16} />
                  </button>
                </form>
              </>
            )}
            {modal === "about" && (
              <>
                <span className="modal-symbol">
                  <Compass size={27} />
                </span>
                <h2>Своя точка. Своя история.</h2>
                <p className="modal-description">
                  «Клёв» — независимый навигатор по Русской рыбалке 4. Собирайте
                  отчёты, сравнивайте снасти и сохраняйте удачные места.
                </p>
                <div className="about-steps">
                  <div>
                    <span>01</span>
                    <p>
                      <strong>Выберите водоём</strong>Отфильтруйте рыбу, снасть
                      и дату отчёта.
                    </p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>
                      <strong>Изучите точку</strong>Посмотрите координаты,
                      наживку и источник публикации. Схема водоёма
                      иллюстративная.
                    </p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>
                      <strong>Поделитесь результатом</strong>Добавьте свой улов
                      — он сохранится отдельно от демонстрационных данных.
                    </p>
                  </div>
                </div>
                <div className="inline-info">
                  <Info size={18} />
                  Это локальная первая версия. Для RF4 STAT нужен адаптер; для
                  VK API — токен с правом чтения стены. Для публичного сервиса
                  понадобятся аккаунты, модерация и адаптеры источников.
                </div>
                <button
                  className="primary-button"
                  onClick={() => setModal(null)}
                >
                  За рыбой
                  <ArrowRight size={16} />
                </button>
              </>
            )}
            {detail && (
              <>
                <span className="modal-symbol">
                  <Fish size={27} />
                </span>
                <div className="section-eyebrow">
                  {detail.demo ? "ДЕМОНСТРАЦИОННЫЙ ОТЧЁТ" : "ОТЧЁТ СООБЩЕСТВА"}
                </div>
                <h2>{detail.fish}</h2>
                <p className="modal-description">
                  {waters.find((w) => w.id === detail.waterId)?.name} ·{" "}
                  {detail.x}:{detail.y}
                </p>
                <div className="detail-grid">
                  {[
                    ["Наживка", detail.bait],
                    ["Снасть", detail.tackle],
                    ["Уловов", String(detail.catches)],
                    ["Вес", detail.weight || "Не указан"],
                    ["Рыболов", detail.author],
                    [
                      "Дата",
                      new Date(detail.publishedAt).toLocaleString("ru-RU"),
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                {detail.note && <p className="detail-note">{detail.note}</p>}
                {detail.sourceUrl ? (
                  <a
                    className="primary-button"
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть публикацию
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <div className="inline-info">
                    <Info size={16} />
                    {detail.demo
                      ? "Вымышленная точка для знакомства с интерфейсом."
                      : "Отчёт добавлен пользователем. Внешняя ссылка не указана."}
                  </div>
                )}
                <button
                  className="secondary-button full-width"
                  onClick={() => toggleFavorite(detail.id)}
                >
                  <Bookmark size={16} />
                  {favorites.includes(detail.id)
                    ? "Убрать из избранного"
                    : "Сохранить в избранное"}
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Info size={18} />
          <span>{toast}</span>
          <button aria-label="Скрыть уведомление" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
