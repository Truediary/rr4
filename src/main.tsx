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
  Camera,
} from "lucide-react";
import "./style.css";
import Explorer from "./Explorer";
import MediaLibrary, { ImageUpload, MediaProvider } from "./Media";
import type { FishingReport as Report } from "../shared/statistics.js";

type Water = {
  id: string;
  name: string;
  level: number;
  kind: string;
  accent: string;
};
type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  checkedAt: string | null;
  status: string | null;
};
type Page = "spots" | "waters" | "sources" | "favorites" | "media";
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

function App() {
  const [page, setPage] = useState<Page>("spots");
  const [waters, setWaters] = useState<Water[]>([]);
  const [fishCatalog, setFishCatalog] = useState<string[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [demo, setDemo] = useState(
    () => new URLSearchParams(location.search).get("demo") === "true",
  );
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
    if (form.getAll("_uploadBusy").includes("1")) {
      notify("Дождитесь окончания загрузки изображений");
      return;
    }
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
        clip: String(form.get("clip") || ""),
        quality: form.get("quality") || "normal",
        ...Object.fromEntries(
          [
            "totalWeightGrams",
            "silver",
            "durationMinutes",
            "temperatureC",
            "depthM",
          ]
            .filter((key) => form.get(key) !== null && form.get(key) !== "")
            .map((key) => [key, Number(form.get(key))]),
        ),
        images: String(form.get("images") || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
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
    { id: "media" as Page, icon: Camera, label: "Фото и карты" },
    { id: "favorites" as Page, icon: Bookmark, label: "Избранное" },
  ];
  return (
    <div className="app reference-layout">
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
              {n.id === "spots" && <span className="nav-new">РР4</span>}
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
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => window.location.reload()}>
                Повторить
              </button>
            </div>
          )}
          {demo ? (
            <div className="demo-banner">
              <Info size={16} />
              <span>
                <strong>Тестовые данные.</strong> Этот режим доступен только для
                разработки.
              </span>
              <button onClick={() => setDemo(false)}>
                Перейти к реальным отчётам
              </button>
            </div>
          ) : (
            <div className="real-mode-banner">
              <Camera size={17} />
              <span>
                <strong>Реальные отчёты РР4.</strong> Отображаются сохранённые
                уловы и материалы из игры.
              </span>
              <button onClick={() => setPage("media")}>
                Добавить фото и карты
              </button>
            </div>
          )}
          {page === "spots" && (
            <Explorer
              reports={reports}
              waters={waters}
              demo={demo}
              loading={loading}
              favorites={favorites}
              onFavorite={toggleFavorite}
              onAdd={() => setModal("report")}
              onNotify={notify}
            />
          )}
          {page === "favorites" && (
            <Explorer
              key="favorites"
              title="Избранные точки"
              initialView="posts"
              reports={reports.filter((report) =>
                favorites.includes(report.id),
              )}
              waters={waters}
              demo={demo}
              loading={loading}
              favorites={favorites}
              onFavorite={toggleFavorite}
              onAdd={() => setModal("report")}
              onNotify={notify}
            />
          )}
          {page === "waters" && (
            <Explorer
              key="waters"
              title="Водоёмы РР4"
              reports={reports}
              waters={waters}
              demo={demo}
              loading={loading}
              favorites={favorites}
              onFavorite={toggleFavorite}
              onAdd={() => setModal("report")}
              onNotify={notify}
            />
          )}
          {page === "media" && <MediaLibrary onNotify={notify} />}
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
                  <details className="extra-report-fields">
                    <summary>Статистика и снасть — необязательно</summary>
                    <div className="form-two">
                      <label>
                        Суммарный вес улова, г
                        <input
                          name="totalWeightGrams"
                          type="number"
                          min="0"
                          step="any"
                        />
                      </label>
                      <label>
                        Доход, серебра
                        <input name="silver" type="number" min="0" step="any" />
                      </label>
                      <label>
                        Время рыбалки, мин
                        <input
                          name="durationMinutes"
                          type="number"
                          min="0.1"
                          step="any"
                        />
                      </label>
                      <label>
                        Температура, °C
                        <input
                          name="temperatureC"
                          type="number"
                          min="-80"
                          max="80"
                          step="any"
                        />
                      </label>
                      <label>
                        Клипса
                        <input name="clip" maxLength={30} placeholder="25" />
                      </label>
                      <label>
                        Глубина, м
                        <input
                          name="depthM"
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                        />
                      </label>
                      <label>
                        Категория
                        <select name="quality">
                          <option value="normal">Обычный улов</option>
                          <option value="trophy">Трофей</option>
                          <option value="rare">Редкий трофей</option>
                          <option value="record">Рекорд</option>
                        </select>
                      </label>
                    </div>
                  </details>
                  <div className="form-field">
                    <span>Скриншоты улова</span>
                    <ImageUpload name="images" />
                  </div>
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
                      наживку и источник публикации. Для точных меток подключите
                      изображение карты из игры.
                    </p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>
                      <strong>Поделитесь результатом</strong>Добавьте свой улов
                      — он сохранится в базе сообщества со скриншотами.
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
    <MediaProvider>
      <App />
    </MediaProvider>
  </React.StrictMode>,
);
