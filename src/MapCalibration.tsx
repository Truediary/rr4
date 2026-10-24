import { useState } from "react";
import { calibrateFromPoints, isCalibratedMap } from "../shared/maps.js";
import type {
  ControlPoint,
  CoordinateSource,
  MapConfig,
  MapPoint,
} from "../shared/maps.js";
import "./map-coordinates.css";

type Bound = "minX" | "maxX" | "minY" | "maxY";
type AnchorInput = { position: MapPoint | null; x: string; y: string };
const fields: [Bound, string][] = [
  ["minX", "X слева"],
  ["maxX", "X справа"],
  ["minY", "Минимальная Y"],
  ["maxY", "Максимальная Y"],
];

export default function MapCalibration({
  map,
  url,
}: {
  map?: MapConfig;
  url: string;
}) {
  const calibration = isCalibratedMap(map) ? map : undefined;
  const [enabled, setEnabled] = useState(Boolean(calibration));
  const [values, setValues] = useState<Record<Bound, string>>(
    () =>
      Object.fromEntries(
        fields.map(([key]) => [
          key,
          calibration ? String(calibration[key]) : "",
        ]),
      ) as Record<Bound, string>,
  );
  const [flipY, setFlipY] = useState(calibration?.flipY ?? true);
  const [source, setSource] = useState<CoordinateSource | undefined>(
    calibration?.coordinateSource,
  );
  const [picking, setPicking] = useState(false);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [anchors, setAnchors] = useState<AnchorInput[]>(() =>
    [0, 1].map((index) => {
      const point = calibration?.coordinateSource?.controlPoints?.[index];
      return point
        ? {
            position: { u: point.u, v: point.v },
            x: String(point.x),
            y: String(point.y),
          }
        : { position: null, x: "", y: "" };
    }),
  );
  function editAnchor(index: number, patch: Partial<AnchorInput>) {
    setAnchors((current) =>
      current.map((point, i) => (i === index ? { ...point, ...patch } : point)),
    );
  }
  function apply() {
    try {
      if (
        !loaded ||
        anchors.some(
          (point) => !point.position || !point.x.trim() || !point.y.trim(),
        )
      )
        throw new Error(
          "Отметьте две точки на изображении и заполните их игровые X и Y",
        );
      const points: ControlPoint[] = anchors.map((point) => ({
        ...point.position!,
        x: Number(point.x),
        y: Number(point.y),
      }));
      const result = calibrateFromPoints(points[0], points[1]);
      setValues(
        Object.fromEntries(
          fields.map(([key]) => [
            key,
            String(Math.round(result[key] * 1e9) / 1e9),
          ]),
        ) as Record<Bound, string>,
      );
      setFlipY(result.flipY);
      setSource({
        kind: "control-points",
        label: "Две точки из игры",
        checkedAt: new Date().toISOString(),
        controlPoints: points,
      });
      setEnabled(true);
      setPicking(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="map-coordinate-settings">
      <label className="map-flip">
        <input
          type="checkbox"
          name="calibrated"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Наложить точки по игровым координатам
      </label>
      <button
        className="calibration-toggle"
        type="button"
        disabled={!url}
        onClick={() => {
          setPicking(!picking);
          setError("");
        }}
      >
        Настроить по двум точкам из игры
      </button>
      {source && enabled && (
        <div className="calibration-source">
          Привязка:{" "}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          ) : (
            source.label
          )}
          . Её можно уточнить по известным точкам.
        </div>
      )}
      {picking && (
        <div className="control-point-editor">
          <p>
            Найдите два узнаваемых места с известными координатами из игры.
            Отметьте их на карте по диагонали, подальше друг от друга, и введите
            X и Y.
          </p>
          <strong>Сейчас отмечается точка {active + 1}</strong>
          <div
            className="control-point-image"
            aria-label="Карта для привязки"
            onClick={(event) => {
              if (!loaded) return;
              const box = event.currentTarget.getBoundingClientRect();
              editAnchor(active, {
                position: {
                  u: (event.clientX - box.left) / box.width,
                  v: (event.clientY - box.top) / box.height,
                },
              });
              if (active === 0) setActive(1);
            }}
          >
            <img
              src={url}
              alt="Изображение для координатной привязки"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                setError("Изображение карты не загрузилось");
              }}
            />
            {anchors.map(
              (anchor, index) =>
                anchor.position && (
                  <span
                    key={index}
                    style={{
                      left: `${anchor.position.u * 100}%`,
                      top: `${anchor.position.v * 100}%`,
                    }}
                  >
                    {index + 1}
                  </span>
                ),
            )}
          </div>
          {anchors.map((anchor, index) => (
            <div className="control-point-fields" key={index}>
              <button
                type="button"
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                Точка {index + 1}
                {anchor.position ? " ✓" : ""}
              </button>
              <label>
                X из игры
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="any"
                  aria-label={`Точка ${index + 1}: X из игры`}
                  value={anchor.x}
                  onChange={(event) =>
                    editAnchor(index, { x: event.target.value })
                  }
                />
              </label>
              <label>
                Y из игры
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="any"
                  aria-label={`Точка ${index + 1}: Y из игры`}
                  value={anchor.y}
                  onChange={(event) =>
                    editAnchor(index, { y: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
          <button type="button" onClick={apply} disabled={!loaded}>
            Применить привязку
          </button>
          <button
            type="button"
            onClick={() => {
              setPicking(false);
              setError("");
            }}
          >
            Отменить настройку
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="calibration-error">
          {error}
        </p>
      )}
      {enabled ? (
        <>
          <div className="map-bounds">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type="number"
                  step="any"
                  required
                  value={values[key]}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }));
                    setSource({ kind: "manual", label: "Ручные границы" });
                  }}
                />
              </label>
            ))}
          </div>
          <label className="map-flip">
            <input
              type="checkbox"
              name="flipY"
              checked={flipY}
              onChange={(event) => {
                setFlipY(event.target.checked);
                setSource({ kind: "manual", label: "Ручные границы" });
              }}
            />
            Y растёт снизу вверх
          </label>
        </>
      ) : (
        <p>
          Пока доступен просмотр карты. Для постановки точек укажите привязку по
          двум местам из игры или задайте числовые границы.
        </p>
      )}
      <input
        type="hidden"
        name="coordinateSource"
        value={source ? JSON.stringify(source) : ""}
      />
      <input
        type="hidden"
        name="_calibrationPending"
        value={picking ? "1" : "0"}
      />
    </div>
  );
}
