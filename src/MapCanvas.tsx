import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Copy, Crosshair, MapPin, Minus, Plus, X } from "lucide-react";
import {
  containImage,
  gameToMap,
  isCalibratedMap,
  pointFromClient,
} from "../shared/maps.js";
import type { GamePoint, MapConfig, PointDraft } from "../shared/maps.js";
import type { Group } from "../shared/statistics.js";
import { useMedia } from "./Media";
import "./map-coordinates.css";

type PersonalPin = GamePoint & { id: string; label: string };
function validPoint(point: GamePoint) {
  return [point.x, point.y].every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 999,
  );
}
function readPins(key: string): PersonalPin[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (p) =>
              p &&
              validPoint(p) &&
              typeof p.id === "string" &&
              typeof p.label === "string",
          )
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

export default function MapCanvas({
  water,
  map,
  groups,
  onPoint,
  onConfigure,
  onAdd,
  onNotify,
}: {
  water: { id: string; name: string };
  map?: MapConfig;
  groups: Group[];
  onPoint: (key: string) => void;
  onConfigure: () => void;
  onAdd: (point: PointDraft) => void;
  onNotify: (text: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const raster = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 800, height: 800 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<GamePoint | null>(null);
  const [selected, setSelected] = useState<GamePoint | null>(null);
  const [query, setQuery] = useState("");
  const [pinLabel, setPinLabel] = useState("");
  const storageKey = `klev-map-pins-${water.id}`;
  const [pins, setPins] = useState(() => readPins(storageKey));
  const calibrated = isCalibratedMap(map) ? map : undefined;
  const imageBox = containImage(
    size.width,
    size.height,
    natural.width,
    natural.height,
  );
  const { assets } = useMedia();
  const asset = assets.find((item) => item.url === map?.url);
  const source = map?.sourceUrl || asset?.sourceUrl;
  const selectedPin =
    selected &&
    pins.find((pin) => pin.x === selected.x && pin.y === selected.y);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: node.clientWidth, height: node.clientHeight }),
    );
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setSelected(null);
    setHover(null);
  }, [map]);
  useEffect(() => {
    const limitX = Math.max(0, (imageBox.width * zoom - size.width) / 2);
    const limitY = Math.max(0, (imageBox.height * zoom - size.height) / 2);
    setOffset((previous) => {
      const x = Math.max(-limitX, Math.min(limitX, previous.x));
      const y = Math.max(-limitY, Math.min(limitY, previous.y));
      return x === previous.x && y === previous.y ? previous : { x, y };
    });
  }, [imageBox.width, imageBox.height, size.width, size.height, zoom]);

  function clampOffset(point: GamePoint, scale = zoom) {
    const limitX = Math.max(0, (imageBox.width * scale - size.width) / 2);
    const limitY = Math.max(0, (imageBox.height * scale - size.height) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, point.x)),
      y: Math.max(-limitY, Math.min(limitY, point.y)),
    };
  }
  function changeZoom(value: number) {
    const next = Math.max(1, Math.min(5, value));
    setZoom(next);
    setOffset((previous) => clampOffset(previous, next));
    setHover(null);
  }
  function fromPointer(x: number, y: number) {
    if (!ready || !raster.current) return null;
    const point = pointFromClient(
      x,
      y,
      raster.current.getBoundingClientRect(),
      map,
    );
    if (!point) return null;
    const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
    return validPoint(rounded) ? rounded : null;
  }
  function select(point: GamePoint) {
    if (!validPoint(point) || !gameToMap(point, map)) {
      onNotify("Эти координаты находятся за пределами карты");
      return;
    }
    setSelected(point);
    setHover(null);
    setQuery(`${point.x}:${point.y}`);
    setPinLabel(
      pins.find((pin) => pin.x === point.x && pin.y === point.y)?.label || "",
    );
  }
  function persistPins(next: PersonalPin[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setPins(next);
      return true;
    } catch {
      onNotify("Браузер не разрешил сохранить личные метки");
      return false;
    }
  }
  const coordinate = hover || selected;
  const target = selected && gameToMap(selected, map);

  return (
    <>
      {map && (
        <form
          className="map-coordinate-search"
          onSubmit={(event) => {
            event.preventDefault();
            const match = query
              .trim()
              .match(/^(\d{1,3})\s*[:,; ]\s*(\d{1,3})$/);
            if (!match) {
              onNotify(
                "Введите игровые координаты в формате X:Y, например 47:20",
              );
              return;
            }
            select({ x: Number(match[1]), y: Number(match[2]) });
          }}
        >
          <input
            aria-label={`Координаты: ${water.name}`}
            placeholder="X:Y"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={24}
            disabled={!calibrated || !ready}
          />
          <button type="submit" disabled={!calibrated || !ready}>
            Найти точку
          </button>
          {!calibrated && (
            <button type="button" onClick={onConfigure}>
              Привязать координаты
            </button>
          )}
        </form>
      )}
      <div
        ref={viewport}
        className={`reference-map coordinate-map ${zoom > 1 ? "zoomed" : ""} ${calibrated ? "can-pick-point" : ""}`}
        style={{ "--map-marker-scale": 1 / zoom } as CSSProperties}
        role="application"
        aria-label={`Карта точек: ${water.name}`}
        tabIndex={calibrated ? 0 : -1}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !calibrated || !ready)
            return;
          const step = event.shiftKey ? 10 : 1;
          const point = selected || {
            x: Math.round((calibrated.minX + calibrated.maxX) / 2),
            y: Math.round((calibrated.minY + calibrated.maxY) / 2),
          };
          const directions: Record<string, GamePoint> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: calibrated.flipY ? step : -step },
            ArrowDown: { x: 0, y: calibrated.flipY ? -step : step },
          };
          if (directions[event.key]) {
            event.preventDefault();
            select({
              x: point.x + directions[event.key].x,
              y: point.y + directions[event.key].y,
            });
          } else if (event.key === "Enter") {
            event.preventDefault();
            select(point);
          }
        }}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button, a")
          )
            return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offset.x,
            oy: offset.y,
            moved: false,
          };
          if (zoom > 1) event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (active) {
            if (
              Math.hypot(event.clientX - active.x, event.clientY - active.y) > 5
            )
              active.moved = true;
            if (zoom > 1 && active.moved)
              setOffset(
                clampOffset({
                  x: active.ox + event.clientX - active.x,
                  y: active.oy + event.clientY - active.y,
                }),
              );
          }
          setHover(fromPointer(event.clientX, event.clientY));
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          drag.current = null;
          if (active && !active.moved && calibrated) {
            const point = fromPointer(event.clientX, event.clientY);
            if (point) select(point);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setHover(null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div
          className="reference-map-content"
          style={{
            transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
          }}
        >
          {map && (
            <div ref={raster} className="map-raster-layer" style={imageBox}>
              <img
                className={`real-water-map reference-only ${ready ? "ready" : ""}`}
                src={map.url}
                alt={`Карта: ${water.name}`}
                draggable={false}
                loading="lazy"
                decoding="async"
                onLoad={(event) => {
                  setNatural({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                  setReady(true);
                  setFailed(false);
                }}
                onError={() => {
                  setReady(false);
                  setFailed(true);
                }}
              />
              {calibrated &&
                ready &&
                groups.map((group) => {
                  const point = gameToMap(group.report, calibrated);
                  return (
                    point && (
                      <button
                        key={group.key}
                        className={`cluster-marker ${group.posts >= 3 ? "red" : group.posts >= 2 ? "yellow" : "green"}`}
                        style={{
                          left: `${point.u * 100}%`,
                          top: `${point.v * 100}%`,
                        }}
                        aria-label={`${water.name}, точка ${group.label}: ${group.posts} постов`}
                        onClick={() => onPoint(group.key)}
                      >
                        <span>{group.posts > 1 ? group.posts : ""}</span>
                      </button>
                    )
                  );
                })}
              {calibrated &&
                ready &&
                pins.map((pin) => {
                  const point = gameToMap(pin, calibrated);
                  return (
                    point && (
                      <button
                        key={pin.id}
                        className="personal-map-pin"
                        style={{
                          left: `${point.u * 100}%`,
                          top: `${point.v * 100}%`,
                        }}
                        aria-label={`Моя метка ${pin.label}: ${pin.x}:${pin.y}`}
                        title={`${pin.label} · ${pin.x}:${pin.y}`}
                        onClick={() => select(pin)}
                      >
                        ★
                      </button>
                    )
                  );
                })}
              {ready && target && (
                <span
                  className="map-target-marker"
                  data-testid={`map-target-${water.id}`}
                  style={{
                    left: `${target.u * 100}%`,
                    top: `${target.v * 100}%`,
                  }}
                  aria-label={`Выбрано ${selected!.x}:${selected!.y}`}
                >
                  <Crosshair size={24} />
                </span>
              )}
            </div>
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
              <span>Загрузите изображение карты из игры.</span>
              <button onClick={onConfigure}>Подключить карту</button>
            </div>
          )}
        </div>
        {map && ready && (
          <div className="reference-map-tools">
            <button
              aria-label={`Увеличить: ${water.name}`}
              onClick={() => changeZoom(zoom + 0.5)}
            >
              <Plus size={19} />
            </button>
            <button
              aria-label={`Уменьшить: ${water.name}`}
              onClick={() => changeZoom(zoom - 0.5)}
            >
              <Minus size={17} />
            </button>
            <button
              aria-label={`Сбросить карту: ${water.name}`}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setHover(null);
              }}
            >
              <Crosshair size={15} />
            </button>
          </div>
        )}
        <span className="map-status-badge">
          {!map
            ? "Нет игровой карты"
            : !ready
              ? failed
                ? "Карта недоступна"
                : "Загрузка карты…"
              : asset?.origin === "user-provided-archive"
                ? "Карта из комплекта"
                : "Карта пользователя"}
        </span>
        {coordinate && calibrated && ready && (
          <output
            className="map-cursor-coordinates"
            aria-label={`Координаты курсора: ${water.name}`}
          >
            X: {coordinate.x} · Y: {coordinate.y}
          </output>
        )}
        {map && ready && (
          <span className="map-caption">
            {calibrated ? (
              calibrated.coordinateSource?.url ? (
                <a
                  href={calibrated.coordinateSource.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Привязка: {calibrated.coordinateSource.label}
                </a>
              ) : (
                "Игровые координаты"
              )
            ) : (
              "Координатная привязка не задана"
            )}{" "}
            {source && (
              <a href={source} target="_blank" rel="noreferrer">
                Источник
              </a>
            )}{" "}
            <a
              href={map.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Открыть оригинал: ${water.name}`}
            >
              Оригинал
            </a>
          </span>
        )}
      </div>
      {map && ready && !groups.length && (
        <p className="no-map-data">Нет отчётов за выбранный период</p>
      )}
      {!(calibrated && ready) && groups.length > 0 && (
        <div className="unmapped-points">
          {groups.map((group) => (
            <button
              key={group.key}
              onClick={() => onPoint(group.key)}
              aria-label={`Открыть точку ${group.label}: ${water.name}`}
            >
              {group.label}
              <b>{group.posts} пост.</b>
            </button>
          ))}
        </div>
      )}
      {selected && target && (
        <div className="map-point-selection">
          <strong aria-live="polite">
            Выбрано: {selected.x}:{selected.y}
          </strong>
          <button
            aria-label={`Скопировать координаты: ${water.name}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${selected.x}:${selected.y}`,
                );
                onNotify("Координаты скопированы");
              } catch {
                onNotify("Не удалось скопировать координаты");
              }
            }}
          >
            <Copy size={13} />
          </button>
          <button onClick={() => onAdd({ waterId: water.id, ...selected })}>
            Добавить отчёт в точке
          </button>
          <input
            aria-label={`Название метки: ${water.name}`}
            value={pinLabel}
            onChange={(event) => setPinLabel(event.target.value)}
            maxLength={80}
            placeholder="Название личной метки"
          />
          {selectedPin ? (
            <button
              onClick={() => {
                if (
                  persistPins(pins.filter((pin) => pin.id !== selectedPin.id))
                )
                  onNotify("Личная метка удалена");
              }}
            >
              Удалить мою метку
            </button>
          ) : (
            <button
              onClick={() => {
                if (pins.length >= 200) {
                  onNotify("Можно сохранить до 200 меток на водоём");
                  return;
                }
                if (
                  persistPins([
                    ...pins,
                    {
                      ...selected,
                      id: crypto.randomUUID(),
                      label: pinLabel.trim() || `${selected.x}:${selected.y}`,
                    },
                  ])
                )
                  onNotify("Личная метка сохранена в этом браузере");
              }}
            >
              Сохранить мою метку
            </button>
          )}
          <button
            aria-label={`Убрать выбранную точку: ${water.name}`}
            onClick={() => {
              setSelected(null);
              setHover(null);
            }}
          >
            <X size={13} />
          </button>
          <small>
            Личные метки хранятся в этом браузере. Уловы и статистика появляются
            только из отчётов.
          </small>
        </div>
      )}
    </>
  );
}
