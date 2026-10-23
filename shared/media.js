export function isImageReference(value) {
  if (typeof value !== "string" || value.length > 2000) return false;
  if (/^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
