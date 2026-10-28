import { Asset } from 'expo-asset';
import { randomUUID } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import type { Query } from './lookup';
import { endOfDay, schedule } from './review';

// Copies earlier builds made of the dictionary, 72 MB each. It is now read in
// place from the app bundle, so these only waste space.
const OLD_COPIES = ['dictionary-1.db', 'dictionary-2.db', 'dictionary-3.db'];

// Captures live in their own file so a new dictionary never touches them.
const CAPTURES_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS capture (
  typed       TEXT PRIMARY KEY,
  lemma       TEXT,
  sense       TEXT,
  captured_at TEXT NOT NULL,
  note        TEXT
);
CREATE TABLE IF NOT EXISTS review (
  typed TEXT PRIMARY KEY REFERENCES capture (typed) ON DELETE CASCADE,
  box   INTEGER NOT NULL,
  due   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS review_due ON review (due);
CREATE TABLE IF NOT EXISTS review_log (
  typed      TEXT NOT NULL,
  at         TEXT NOT NULL,
  knew       INTEGER NOT NULL,
  box_before INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS play_log (
  game    TEXT NOT NULL,
  typed   TEXT NOT NULL,
  at      TEXT NOT NULL,
  correct INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS device (id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO review (typed, box, due) SELECT typed, 0, captured_at FROM capture;
`;

export type Capture = {
  typed: string;
  lemma: string | null;
  sense: string | null;
  captured_at: string;
  note: string | null;
};

export type Databases = { dictionary: Query; captures: SQLite.SQLiteDatabase };

export async function openDatabases(): Promise<Databases> {
  const dictionary = await openDictionary();
  for (const old of OLD_COPIES) {
    await SQLite.deleteDatabaseAsync(old).catch(() => undefined);
  }
  const captures = await SQLite.openDatabaseAsync('captures.db');
  await captures.execAsync(CAPTURES_SCHEMA);
  // The key a later backup uploads under. Nothing reads it yet.
  await captures.runAsync(
    'INSERT INTO device (id) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM device)', [randomUUID()]);
  return {
    dictionary: (sql, params) => dictionary.getAllAsync(sql, params),
    captures,
  };
}

// Read-only, straight from the app bundle: copying it would store 72 MB twice.
// A release build resolves the asset to its file inside the bundle without a
// download; only a dev build fetches it from Metro into the cache.
async function openDictionary() {
  const asset = await Asset.fromModule(require('../assets/dictionary.db')).downloadAsync();
  if (!asset.localUri) throw new Error('dictionary.db is not in the bundle');
  const slash = asset.localUri.lastIndexOf('/');
  return SQLite.openDatabaseAsync(
    asset.localUri.slice(slash + 1), {}, asset.localUri.slice(0, slash));
}

// withTransactionAsync is a bare BEGIN/COMMIT on the shared connection: two at
// once nest, fail, and the loser's ROLLBACK aborts the winner. Run them in turn.
let pending: Promise<unknown> = Promise.resolve();

function serially(task: () => Promise<void>): Promise<void> {
  const run = pending.then(task, task);
  pending = run.catch(() => undefined);
  return run;
}

export function saveCapture(db: SQLite.SQLiteDatabase, typed: string) {
  const now = new Date().toISOString();
  return serially(() => db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO capture (typed, captured_at) VALUES (?, ?)
       ON CONFLICT (typed) DO UPDATE SET captured_at = excluded.captured_at`,
      [typed, now]);
    await db.runAsync('INSERT OR IGNORE INTO review (typed, box, due) VALUES (?, 0, ?)', [typed, now]);
  }));
}

export async function chooseSense(
  db: SQLite.SQLiteDatabase, typed: string, lemma: string, sense: string) {
  await db.runAsync('UPDATE capture SET lemma = ?, sense = ? WHERE typed = ?', [lemma, sense, typed]);
}

export async function getCapture(db: SQLite.SQLiteDatabase, typed: string) {
  return db.getFirstAsync<Capture>('SELECT * FROM capture WHERE typed = ?', [typed]);
}

export async function listCaptures(db: SQLite.SQLiteDatabase) {
  return db.getAllAsync<Capture>('SELECT * FROM capture ORDER BY captured_at DESC', []);
}

export async function deleteCapture(db: SQLite.SQLiteDatabase, typed: string) {
  await db.runAsync('DELETE FROM capture WHERE typed = ?', [typed]);
}

export async function playableCaptures(db: SQLite.SQLiteDatabase) {
  return db.getAllAsync<Capture & { box: number }>(
    'SELECT c.*, r.box FROM capture c JOIN review r ON r.typed = c.typed', []);
}

// Kept apart from review_log: a game answer is practice, not a review, and
// must not move a word between boxes or skew a future scheduler.
export type Game = 'which' | 'spell';

export async function logPlay(db: SQLite.SQLiteDatabase, game: Game, typed: string, correct: boolean) {
  await db.runAsync('INSERT INTO play_log (game, typed, at, correct) VALUES (?, ?, ?, ?)',
    [game, typed, new Date().toISOString(), correct ? 1 : 0]);
}

export async function getReview(db: SQLite.SQLiteDatabase, typed: string) {
  return db.getFirstAsync<{ box: number; due: string }>(
    'SELECT box, due FROM review WHERE typed = ?', [typed]);
}

export async function dueCount(db: SQLite.SQLiteDatabase, now = new Date()) {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM review WHERE due <= ?', [endOfDay(now)]);
  return row?.n ?? 0;
}

export async function dueWords(db: SQLite.SQLiteDatabase, now = new Date()) {
  const rows = await db.getAllAsync<{ typed: string }>(
    'SELECT typed FROM review WHERE due <= ? ORDER BY due, typed', [endOfDay(now)]);
  return rows.map(({ typed }) => typed);
}

export async function nextReview(db: SQLite.SQLiteDatabase, now = new Date()) {
  const next = await db.getFirstAsync<{ due: string | null }>(
    'SELECT min(due) AS due FROM review WHERE due > ?', [endOfDay(now)]);
  if (!next?.due) return null;
  const words = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM review WHERE due > ? AND due <= ?',
    [endOfDay(now), endOfDay(new Date(next.due))]);
  return { due: new Date(next.due), words: words?.n ?? 0 };
}

export function recordAnswer(
  db: SQLite.SQLiteDatabase, typed: string, knew: boolean, moves: boolean) {
  const now = new Date();
  return serially(() => db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ box: number }>('SELECT box FROM review WHERE typed = ?', [typed]);
    if (!row) return;
    await db.runAsync('INSERT INTO review_log (typed, at, knew, box_before) VALUES (?, ?, ?, ?)',
      [typed, now.toISOString(), knew ? 1 : 0, row.box]);
    if (moves) {
      const next = schedule(row.box, knew, now);
      await db.runAsync('UPDATE review SET box = ?, due = ? WHERE typed = ?', [next.box, next.due, typed]);
    }
  }));
}
