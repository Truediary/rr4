import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
const metadataSchema = z.object({
  kind: z.enum(["catch", "map", "fish", "bait"]).default("catch"),
  label: z.string().trim().max(120).default(""),
  entity: z.string().trim().max(120).default(""),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }),
});
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5, fieldSize: 4000 },
}).single("file");
export async function saveImage(file, metadata, directory, store) {
  if (!file) throw new Error("Выберите изображение PNG, JPEG или WebP");
  const details = metadataSchema.parse(metadata);
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type.mime))
    throw new Error(
      "Допускаются только PNG, JPEG и WebP. Тип определяется по содержимому файла.",
    );
  const id = randomUUID();
  const filename = `${id}.${type.ext}`;
  const path = join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(path, file.buffer, { flag: "wx" });
  const asset = {
    id,
    url: `/media/${filename}`,
    kind: details.kind,
    label: details.label || file.originalname.slice(0, 120),
    entity: details.entity,
    sourceUrl: details.sourceUrl || null,
    mime: type.mime,
    size: file.size,
    createdAt: new Date().toISOString(),
    origin: "user-upload",
  };
  try {
    store.addMedia(asset);
  } catch (error) {
    await unlink(path);
    throw error;
  }
  return asset;
}
