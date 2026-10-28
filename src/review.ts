// Spaced repetition as Leitner boxes: each right answer moves a word one box
// up and waits longer; a wrong one sends it back to the first box. Every
// answer is logged, so a better scheduler (FSRS) can replay the history later.
// No imports, so test/review.test.mjs runs this exact file.

export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
export const SESSION_SIZE = 20;

const DAY = 24 * 60 * 60 * 1000;

export type Schedule = { box: number; due: string };

export function schedule(box: number, knew: boolean, now: Date): Schedule {
  const next = knew ? Math.min(box + 1, INTERVAL_DAYS.length - 1) : 1;
  return { box: next, due: new Date(now.getTime() + INTERVAL_DAYS[next] * DAY).toISOString() };
}

// A word due at any hour today is due all day: you review in the evening,
// not at the minute it was scheduled.
export function endOfDay(now: Date): string {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export type Session = { queue: string[]; seen: Set<string> };

export function startSession(due: string[]): Session {
  return { queue: due.slice(0, SESSION_SIZE), seen: new Set() };
}

// A missed word comes back once at the end of the session, so you leave
// having got it right. Only the first answer moves it between boxes.
export function answer(session: Session, knew: boolean): { session: Session; first: boolean } {
  const [current, ...rest] = session.queue;
  const first = !session.seen.has(current);
  const seen = new Set(session.seen).add(current);
  const queue = !knew && first ? [...rest, current] : rest;
  return { session: { queue, seen }, first };
}
