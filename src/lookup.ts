// The lookup half of grafia-corpus/grafia/dictionary.py. The build does the
// linguistics; this only runs its queries. No imports, so the Node test in
// test/forms.test.mjs runs this exact file against tests/forms.txt.

export type Query = <T>(sql: string, params: (string | number)[]) => Promise<T[]>;

export type Result = { lemma: string; phrase: string | null; base: string | null };
export type Sense = { id: string; pos: string; gloss: string };
export type Suggestion = { key: string; lemma: string };

const RESULTS = `
SELECT e.lemma AS lemma, r.phrase AS phrase, b.lemma AS base
FROM lookup l
JOIN entry e ON e.id = l.entry_id
LEFT JOIN relation r ON r.id = l.relation_id
LEFT JOIN entry b ON b.id = l.base_id
WHERE `;

const POS: Record<string, string> = {
  noun: 'sustantivo',
  adj: 'adjetivo',
  verb: 'verbo',
  adv: 'adverbio',
  intj: 'interjección',
  num: 'numeral',
  prep: 'preposición',
  pron: 'pronombre',
  conj: 'conjunción',
  article: 'artículo',
  phrase: 'locución',
  contraction: 'contracción',
  abbrev: 'abreviatura',
};

export function normalize(typed: string): string {
  return typed.trim().toLowerCase();
}

// ñ and ü are letters, not accents: flattening them collides canon and cañón.
// Must match strip_accents in grafia-corpus/grafia/text.py.
export function stripAccents(word: string): string {
  return word
    .toLowerCase()
    .replace(/ñ/g, '\x01')
    .replace(/ü/g, '\x02')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\x01/g, 'ñ')
    .replace(/\x02/g, 'ü');
}

// Must match RARE_READING and SCORE_PER_ZIPF in grafia-corpus/grafia/dictionary.py.
const RARE_READING = 1.5;
const SCORE_PER_ZIPF = 200;

// The spellings a typed word stands for, most frequent first. Typed with an
// accent, it means exactly that. Typed without, it may be any accented
// spelling: licito is a form of licitar, but the reader almost always means
// lícito. Must match keys_for in dictionary.py.
export async function keysFor(query: Query, typed: string): Promise<string[]> {
  const word = normalize(typed);
  const plain = stripAccents(word);
  if (plain !== word) {
    const exact = await query<{ key: string }>('SELECT key FROM lookup WHERE key = ? LIMIT 1', [word]);
    if (exact.length > 0) return [word];
  }
  let scored = await query<{ key: string; score: number }>(
    'SELECT key, score FROM spelling WHERE plain = ? ORDER BY score DESC, key', [plain]);
  // A form never seen in text has no spelling row; it still counts, at zero.
  if (!scored.some(({ key }) => key === word)) {
    const exists = await query<{ key: string }>('SELECT key FROM lookup WHERE key = ? LIMIT 1', [word]);
    if (exists.length > 0) scored = [...scored, { key: word, score: 0 }];
  }
  // If what was typed is itself a word, another spelling has to be more
  // frequent to join it: lícito beats licito, arrebolés does not beat arreboles.
  const typedScore = scored.find(({ key }) => key === word)?.score;
  if (typedScore !== undefined) {
    scored = scored.filter(({ key, score }) => key === word || score >= typedScore + 2);
  }
  const best = scored[0]?.score ?? 0;
  return scored
    .filter(({ score }) => score >= best - RARE_READING * SCORE_PER_ZIPF)
    .map(({ key }) => key);
}

export async function lookup(query: Query, typed: string): Promise<Result[]> {
  const rows: Result[] = [];
  for (const key of await keysFor(query, typed)) {
    rows.push(...await query<Result>(`${RESULTS} l.key = ? ORDER BY l.rank`, [key]));
  }
  // Two spellings can reach the same entry.
  const unique = new Map(rows.map((row) => [`${row.lemma}|${row.phrase}|${row.base}`, row]));
  return [...unique.values()];
}

// The spelling to save: typing licito must save lícito, or one word becomes
// two captures. Unknown words keep what was typed.
export async function canonical(query: Query, typed: string): Promise<string> {
  return (await keysFor(query, typed))[0] ?? normalize(typed);
}

// Every form starting with what was typed, accents ignored, most frequent first.
export async function suggest(query: Query, typed: string, limit = 8): Promise<Suggestion[]> {
  const prefix = stripAccents(normalize(typed));
  if (!prefix) return [];
  const keys = await query<{ key: string }>(
    `SELECT key FROM spelling WHERE plain >= ? AND plain < ? AND suggested
     ORDER BY score DESC, length(key), key LIMIT ?`,
    [prefix, `${prefix}￿`, limit]);
  if (keys.length === 0) return [];
  const lemmas = await query<Suggestion>(
    `SELECT l.key AS key, e.lemma AS lemma FROM lookup l JOIN entry e ON e.id = l.entry_id
     WHERE l.rank = 0 AND l.key IN (${keys.map(() => '?').join(', ')})`,
    keys.map(({ key }) => key));
  const lemmaOf = new Map(lemmas.map(({ key, lemma }) => [key, lemma]));
  return keys.map(({ key }) => ({ key, lemma: lemmaOf.get(key) ?? key }));
}

export async function sensesOf(query: Query, lemma: string): Promise<Sense[]> {
  return query<Sense>(
    `SELECT s.id, s.pos, s.gloss FROM sense s JOIN entry e ON e.id = s.entry_id
     WHERE e.lemma = ? ORDER BY s.ord`, [lemma]);
}

export async function glossesOf(query: Query, senseIds: string[]): Promise<Map<string, string>> {
  if (senseIds.length === 0) return new Map();
  const rows = await query<{ id: string; gloss: string }>(
    `SELECT id, gloss FROM sense WHERE id IN (${senseIds.map(() => '?').join(', ')})`, senseIds);
  return new Map(rows.map(({ id, gloss }) => [id, gloss]));
}

export async function etymologyOf(query: Query, lemma: string): Promise<string | null> {
  const rows = await query<{ etymology: string | null }>(
    'SELECT etymology FROM entry WHERE lemma = ?', [lemma]);
  return rows[0]?.etymology ?? null;
}

export function posLabel(pos: string): string | null {
  return POS[pos] ?? null;
}

export async function senseById(query: Query, id: string): Promise<Sense | null> {
  const rows = await query<Sense>('SELECT id, pos, gloss FROM sense WHERE id = ?', [id]);
  return rows[0] ?? null;
}

// Headwords with this part of speech, for options when too few words are saved.
export async function randomLemmas(query: Query, pos: string, limit: number): Promise<string[]> {
  const rows = await query<{ lemma: string }>(
    `SELECT e.lemma AS lemma FROM sense s JOIN entry e ON e.id = s.entry_id
     WHERE s.ord = 0 AND s.pos = ? ORDER BY random() LIMIT ?`, [pos, limit]);
  return rows.map(({ lemma }) => lemma);
}
