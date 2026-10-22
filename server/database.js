import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, type TEXT NOT NULL, checked_at TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return {
    db,
    getSetting(key) {
      return db.prepare("SELECT value FROM settings WHERE key=?").get(key)
        ?.value;
    },
    setSetting(key, value) {
      db.prepare("INSERT OR REPLACE INTO settings VALUES(?,?)").run(key, value);
    },
    reports() {
      return db
        .prepare("SELECT payload FROM reports")
        .all()
        .map((r) => JSON.parse(r.payload))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
    addReport(report, sourceName = "Сообщество", sourceId = null) {
      const normalized = {
        ...report,
        publishedAt: report.publishedAt ?? new Date().toISOString(),
      };
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            sourceId,
            normalized.sourceUrl,
            normalized.waterId,
            normalized.fish.toLowerCase(),
            normalized.x,
            normalized.y,
            normalized.bait,
            normalized.publishedAt.slice(0, 10),
          ]),
        )
        .digest("hex");
      const payload = {
        ...normalized,
        id: randomUUID(),
        sourceName,
        sourceId,
        demo: false,
      };
      const result = db
        .prepare("INSERT OR IGNORE INTO reports VALUES(?,?,?)")
        .run(payload.id, fingerprint, JSON.stringify(payload));
      return result.changes ? payload : null;
    },
    sources() {
      return db
        .prepare(
          "SELECT id,name,url,type,checked_at AS checkedAt,status FROM sources",
        )
        .all();
    },
    addSource(source) {
      const id = randomUUID();
      db.prepare("INSERT INTO sources(id,name,url,type) VALUES(?,?,?,?)").run(
        id,
        source.name,
        source.url,
        source.type,
      );
      return id;
    },
    markSource(id, status) {
      db.prepare("UPDATE sources SET checked_at=?,status=? WHERE id=?").run(
        new Date().toISOString(),
        status,
        id,
      );
    },
    deleteSource(id) {
      return db.prepare("DELETE FROM sources WHERE id=?").run(id).changes;
    },
  };
}
