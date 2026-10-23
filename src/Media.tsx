import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Camera,
  Upload,
  Image,
  ExternalLink,
  Fish,
  Map,
  Anchor,
} from "lucide-react";
import "./media.css";
export type MediaAsset = {
  id: string;
  url: string;
  kind: "catch" | "map" | "fish" | "bait";
  label: string;
  entity: string;
  sourceUrl: string | null;
  createdAt: string;
  size: number;
  aliases?: string[];
};
const MediaContext = createContext<{
  assets: MediaAsset[];
  refresh: () => Promise<void>;
}>({ assets: [], refresh: async () => {} });
export function useMedia() {
  return useContext(MediaContext);
}
export function MapReference() {
  return (
    <div className="map-reference">
      <a href="https://rf4map.ru/" target="_blank" rel="noreferrer">
        Карты на RF4MAP <ExternalLink size={12} />
      </a>
      <span>
        Для изображения с этого сайта сохраните ссылку на страницу источника.
        Карту можно загрузить файлом или указать прямой адрес изображения.
      </span>
    </div>
  );
}
export function MediaProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  async function refresh() {
    const response = await fetch("/api/media");
    if (!response.ok)
      throw new Error("Не удалось загрузить библиотеку изображений");
    setAssets(await response.json());
  }
  useEffect(() => {
    refresh().catch(() => {});
  }, []);
  return (
    <MediaContext.Provider value={{ assets, refresh }}>
      {children}
    </MediaContext.Provider>
  );
}
export async function uploadImage(
  file: File,
  metadata: Partial<
    Pick<MediaAsset, "kind" | "label" | "entity" | "sourceUrl">
  > = {},
) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Максимальный размер изображения — 10 МБ");
  const form = new FormData();
  form.set("file", file);
  for (const [key, value] of Object.entries(metadata))
    if (value) form.set(key, value);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Не удалось загрузить изображение");
  return result as MediaAsset;
}
export function ImageUpload({
  name,
  kind = "catch",
  single = false,
  defaultValue = "",
  required = false,
  label = single ? "Адрес изображения" : "Ссылки на скриншоты",
}: {
  name: string;
  kind?: MediaAsset["kind"];
  single?: boolean;
  defaultValue?: string;
  required?: boolean;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { assets, refresh } = useMedia();
  const libraryMaps = assets.filter((asset) => asset.kind === "map");
  const urls = value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  async function selected(files: FileList | null) {
    if (!files?.length) return;
    if (!single && urls.length + files.length > 8) {
      setError("Можно добавить не больше 8 изображений");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved: MediaAsset[] = [];
      for (const file of Array.from(files).slice(0, single ? 1 : 8)) {
        saved.push(await uploadImage(file, { kind }));
      }
      setValue((current) =>
        single
          ? saved[0].url
          : [current, ...saved.map((s) => s.url)].filter(Boolean).join("\n"),
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="image-upload-control">
      {single && kind === "map" && libraryMaps.length > 0 && (
        <label className="library-map-picker">
          Из библиотеки карт
          <select
            value={libraryMaps.some((asset) => asset.url === value) ? value : ""}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Выберите сохранённую карту</option>
            {libraryMaps.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {[asset.label, asset.entity].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="upload-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={14} />
          {busy
            ? "Загружаем…"
            : single
              ? "Загрузить файл карты"
              : "Загрузить скриншоты"}
        </button>
        <small>PNG / JPEG / WebP · до 10 МБ</small>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={!single}
        aria-label={single ? "Файл карты" : "Файлы скриншотов"}
        onChange={(e) => selected(e.target.files)}
        className="file-picker"
      />
      {single ? (
        <input
          name={name}
          aria-label={label}
          value={value}
          required={required}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Загрузите файл или вставьте HTTPS-ссылку"
        />
      ) : (
        <textarea
          name={name}
          aria-label={label}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Или вставьте HTTPS-ссылки, по одной на строку"
        />
      )}
      {urls.length > 0 && (
        <div className="upload-previews">
          {urls.slice(0, 8).map((url, i) => (
            <div key={url + i}>
              <img
                src={url}
                alt={
                  single
                    ? "Предпросмотр карты"
                    : `Загруженный скриншот ${i + 1}`
                }
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <button
                type="button"
                aria-label={`Убрать изображение ${i + 1}`}
                onClick={() =>
                  setValue(urls.filter((_, index) => index !== i).join("\n"))
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="upload-error">
          {error}
        </p>
      )}
      <input type="hidden" name="_uploadBusy" value={busy ? "1" : "0"} />
    </div>
  );
}
export function GameImage({
  kind,
  entity,
  className = "",
  fallback = "",
}: {
  kind: MediaAsset["kind"];
  entity: string;
  className?: string;
  fallback?: string;
}) {
  const { assets } = useMedia();
  const asset = assets.find(
    (a) =>
      a.kind === kind &&
      [a.entity, ...(a.aliases || [])].some(
        (name) =>
          name.toLocaleLowerCase("ru-RU") === entity.toLocaleLowerCase("ru-RU"),
      ),
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset?.id]);
  return asset && !failed ? (
    <img
      className={`game-image ${className}`}
      src={asset.url}
      alt={asset.label || entity}
      title={
        asset.sourceUrl
          ? `Источник: ${asset.sourceUrl}`
          : "Загруженное изображение"
      }
      onError={() => setFailed(true)}
    />
  ) : fallback ? (
    <span className="missing-game-image">
      <Camera size={22} />
      {fallback}
    </span>
  ) : (
    <img
      src={
        kind === "fish"
          ? "/game-assets/fish-icon.png"
          : "/game-assets/bait-icon.png"
      }
      className="catalog-game-ui-icon"
      alt={
        kind === "fish"
          ? "Значок рыбы из интерфейса РР4"
          : "Значок наживки из интерфейса РР4"
      }
    />
  );
}
const kinds = {
  catch: "Скриншот улова",
  map: "Карта водоёма",
  fish: "Изображение рыбы",
  bait: "Изображение наживки",
};
export default function MediaLibrary({
  onNotify,
}: {
  onNotify: (text: string) => void;
}) {
  const { assets, refresh } = useMedia();
  const [kind, setKind] = useState<MediaAsset["kind"]>("catch");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      onNotify("Выберите файл изображения");
      return;
    }
    setBusy(true);
    try {
      await uploadImage(file, {
        kind,
        label: String(form.get("label") || ""),
        entity: String(form.get("entity") || ""),
        sourceUrl: String(form.get("sourceUrl") || ""),
      });
      await refresh();
      formElement.reset();
      onNotify("Изображение сохранено на сервере.");
    } catch (e) {
      onNotify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="media-library">
      <div className="section-heading">
        <div>
          <div className="section-eyebrow">МАТЕРИАЛЫ ИЗ ИГРЫ И ПУБЛИКАЦИЙ</div>
          <h2>
            Фото и карты<span>{assets.length}</span>
          </h2>
        </div>
      </div>
      <div className="media-intro">
        <Camera size={24} />
        <div>
          <strong>Скриншоты из Русской рыбалки 4</strong>
          <p>
            Загрузите свой улов, изображение рыбы или наживки, карту водоёма.
            Файлы сохраняются на сервере. Источник можно указать ссылкой на
            публикацию.
          </p>
        </div>
      </div>
      <MapReference />
      <form className="media-library-form" onSubmit={submit}>
        <label>
          Тип материала
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MediaAsset["kind"])}
          >
            {Object.entries(kinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Название
          <input
            name="label"
            maxLength={120}
            placeholder="Например, Линь из игрового справочника"
          />
        </label>
        <label>
          {kind === "fish"
            ? "Название рыбы в отчётах"
            : kind === "bait"
              ? "Название наживки в отчётах"
              : kind === "map"
                ? "Водоём"
                : "Рыба или точка"}
          <input
            name="entity"
            required={kind === "fish" || kind === "bait"}
            maxLength={120}
            placeholder={
              kind === "fish"
                ? "Линь"
                : kind === "bait"
                  ? "Творожное тесто"
                  : "Необязательно"
            }
          />
        </label>
        <label>
          Источник <span>необязательно для своих скриншотов</span>
          <input
            name="sourceUrl"
            type="url"
            placeholder="https://vk.ru/wall..."
          />
        </label>
        <label className="library-file-label">
          <span>
            <Upload size={20} />
            <b>Выберите изображение</b>PNG, JPEG, WebP · до 10 МБ
          </span>
          <input
            ref={fileInput}
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-label="Файл материала"
          />
        </label>
        <button type="submit" disabled={busy} className="primary-button">
          <Upload size={15} />
          {busy ? "Загружаем…" : "Сохранить материал"}
        </button>
      </form>
      <div className="media-gallery-heading">
        <h3>Библиотека материалов</h3>
        <select
          aria-label="Фильтр материалов"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Все типы</option>
          {Object.entries(kinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="media-gallery">
        {assets
          .filter((a) => !filter || a.kind === filter)
          .map((asset) => (
            <article key={asset.id}>
              <a href={asset.url} target="_blank" rel="noreferrer">
                <img src={asset.url} alt={asset.label} loading="lazy" />
              </a>
              <div>
                <span>{kinds[asset.kind]}</span>
                <strong>{asset.label}</strong>
                {asset.entity && <p>{asset.entity}</p>}
                <code>{asset.url}</code>
                {asset.sourceUrl ? (
                  <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                    Источник
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <small>Загружено пользователем</small>
                )}
              </div>
            </article>
          ))}
      </div>
      {!assets.filter((a) => !filter || a.kind === filter).length && (
        <div className="reference-empty">
          <Image size={28} />
          <strong>Пока нет изображений</strong>
          <p>
            Добавьте файлы из игры. Для рыбы и наживки укажите точное название —
            изображение появится в соответствующих отчётах.
          </p>
        </div>
      )}
    </section>
  );
}
