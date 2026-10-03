import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { scenes } from "./scenes.js";

export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS scenes (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS targets (
      scene_id TEXT REFERENCES scenes(id), character_id TEXT, x REAL NOT NULL, y REAL NOT NULL,
      half_width REAL NOT NULL, half_height REAL NOT NULL, PRIMARY KEY(scene_id, character_id)
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, scene_id TEXT REFERENCES scenes(id),
      started_at INTEGER NOT NULL, finished_at INTEGER, last_attempt_at INTEGER DEFAULT 0,
      submitted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS finds (
      round_id TEXT REFERENCES rounds(id) ON DELETE CASCADE, character_id TEXT, x REAL, y REAL,
      PRIMARY KEY(round_id, character_id)
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY, round_id TEXT UNIQUE REFERENCES rounds(id),
      scene_id TEXT REFERENCES scenes(id), name TEXT NOT NULL, duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS leaderboard ON scores(scene_id, duration_ms, created_at);
    CREATE INDEX IF NOT EXISTS round_owner ON rounds(owner, started_at);
  `);
  const sceneStatement = db.prepare(
    "INSERT INTO scenes VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
  );
  const targetStatement = db.prepare(
    "INSERT OR REPLACE INTO targets VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const scene of scenes) {
    sceneStatement.run(scene.id, scene.name);
    for (const target of scene.targets) {
      targetStatement.run(
        scene.id,
        target.id,
        target.x / scene.width,
        target.y / scene.height,
        20 / scene.width,
        35 / scene.height,
      );
    }
  }
  return db;
}
