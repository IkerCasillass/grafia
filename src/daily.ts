// The word of the day's files, as grafia-corpus/grafia/daily.py writes them
// (contract in grafia-corpus/docs/BACKEND.md, Stage 0). No imports, so
// test/daily.test.mjs runs this exact file.

// Must match contentBase in targets/widget/DailyWordWidget.swift.
export const CONTENT_URL = 'https://content.grafia.mx';

export type DailyWord = {
  date: string;
  from: string;
  until: string;
  word: {
    lemma: string;
    pos: string | null;
    definition: string;
    example: string | null;
    etymology: string | null;
    syllables: string[] | null;
  };
};

// The day is America/Mexico_City, never the device clock. Mexico has had no
// DST since 2022, so its midnight is a fixed 06:00 UTC; Hermes' Intl time-zone
// support can't be relied on, and the file's from/until stay authoritative.
export function mexicoDate(now: Date): string {
  return new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function fileUrl(date: string, base = CONTENT_URL): string {
  return `${base}/palabra/${date}.json`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(value: string): boolean {
  return DATE.test(value);
}

// Anything off the network is untrusted until its shape is checked.
export function parseDaily(raw: unknown): DailyWord | null {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Record<string, unknown>;
  const word = file.word as Record<string, unknown> | undefined;
  const text = (value: unknown) => typeof value === 'string' && value.length > 0;
  const optional = (value: unknown) => value === null || value === undefined || typeof value === 'string';
  if (!text(file.date) || !isDate(file.date as string) || !text(file.from) || !text(file.until)) return null;
  if (!word || !text(word.lemma) || !text(word.definition)) return null;
  if (!optional(word.pos) || !optional(word.example) || !optional(word.etymology)) return null;
  const syllables = Array.isArray(word.syllables) && word.syllables.every((s) => typeof s === 'string')
    ? (word.syllables as string[])
    : null;
  return {
    date: file.date as string,
    from: file.from as string,
    until: file.until as string,
    word: {
      lemma: word.lemma as string,
      pos: (word.pos as string | null | undefined) ?? null,
      definition: word.definition as string,
      example: (word.example as string | null | undefined) ?? null,
      etymology: (word.etymology as string | null | undefined) ?? null,
      syllables,
    },
  };
}
