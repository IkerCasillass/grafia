// "¿Cuál es?": a definition of a saved word, and four words to choose from.
// No imports, so test/game.test.mjs runs this exact file.

export const ROUNDS = 10;
export const OPTIONS = 4;

export type Playable = { typed: string; lemma: string; gloss: string; pos: string; box: number };
export type Question = { answer: string; gloss: string; options: string[] };

type Random = () => number;

export function shuffle<T>(items: T[], random: Random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ñ and ü are letters, not accents: guinapo is not a near miss for guiñapo.
function plain(word: string): string {
  return word
    .toLowerCase()
    .replace(/ñ/g, '\x01')
    .replace(/ü/g, '\x02')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\x01/g, 'ñ')
    .replace(/\x02/g, 'ü');
}

function stem(word: string): string {
  return plain(word).slice(0, Math.min(5, Math.max(3, word.length - 2)));
}

// A definition that names its own root gives the answer away: amigdalectomía
// has to say amígdalas. Hide any word sharing the answer's stem.
export function maskGloss(gloss: string, words: string[]): string {
  const stems = [...new Set(words.map(stem))].filter((s) => s.length >= 3);
  return gloss.replace(/[\p{L}]+/gu, (token) =>
    stems.some((s) => plain(token).startsWith(s)) ? '…' : token);
}

// Words still in low boxes are the ones worth practising.
export function pickTargets(words: Playable[], random: Random = Math.random): Playable[] {
  return shuffle(words, random)
    .sort((a, b) => a.box - b.box)
    .slice(0, ROUNDS);
}

// Wrong options share the answer's part of speech: a verb's definition starts
// with an infinitive, so a noun among the options would give itself away.
export function buildQuestion(
  target: Playable, saved: Playable[], fillers: string[], random: Random = Math.random,
): Question {
  const taken = new Set([plain(target.typed), plain(target.lemma)]);
  const distractors: string[] = [];
  const offer = (word: string) => {
    if (distractors.length < OPTIONS - 1 && !taken.has(plain(word))) {
      distractors.push(word);
      taken.add(plain(word));
    }
  };
  shuffle(saved.filter((w) => w.pos === target.pos), random).forEach((w) => {
    if (!taken.has(plain(w.lemma))) offer(w.typed);
  });
  fillers.forEach(offer);
  return {
    answer: target.typed,
    gloss: maskGloss(target.gloss, [target.typed, target.lemma]),
    options: shuffle([target.typed, ...distractors], random),
  };
}

// "Escríbela": the definition, a letter pattern, and the word to type.

export type Spelling = { answer: string; accepted: string[]; gloss: string };
export type Verdict = 'right' | 'accent' | 'wrong';

export function buildSpelling(target: Playable): Spelling {
  return {
    answer: target.lemma,
    accepted: [target.lemma, target.typed],
    gloss: maskGloss(target.gloss, [target.typed, target.lemma]),
  };
}

// Right letters with a missing or wrong accent still count: the point is the
// word, and the note teaches the tilde.
export function checkSpelling(input: string, accepted: string[]): Verdict {
  const word = input.trim().toLowerCase();
  if (accepted.some((answer) => answer.toLowerCase() === word)) return 'right';
  if (accepted.some((answer) => plain(answer) === plain(word))) return 'accent';
  return 'wrong';
}

export function letterPattern(answer: string, revealed: number): string {
  return [...answer].map((letter, n) => (n < revealed ? letter : '_')).join(' ');
}
