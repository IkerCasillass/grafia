import assert from 'node:assert/strict';
import { test } from 'node:test';

import { INTERVAL_DAYS, answer, endOfDay, schedule, startSession } from '../src/review.ts';

const now = new Date('2026-10-27T20:00:00');
const daysUntil = (due) => Math.round((new Date(due) - now) / 86_400_000);

test('a right answer moves up a box and waits longer', () => {
  assert.deepEqual([1, 2, 3].map((box) => daysUntil(schedule(box, true, now).due)), [3, 7, 14]);
});

test('the last box is a ceiling', () => {
  const last = INTERVAL_DAYS.length - 1;
  assert.equal(schedule(last, true, now).box, last);
});

test('a wrong answer goes back to the first box, due tomorrow', () => {
  const next = schedule(5, false, now);
  assert.equal(next.box, 1);
  assert.equal(daysUntil(next.due), 1);
});

test('due at any hour today counts as today', () => {
  assert.ok(new Date('2026-10-27T23:30:00').toISOString() <= endOfDay(now));
  assert.ok(new Date('2026-10-28T00:30:00').toISOString() > endOfDay(now));
});

test('a missed word returns once at the end of the session', () => {
  let session = startSession(['a', 'b']);
  let first;
  ({ session, first } = answer(session, false));
  assert.deepEqual(session.queue, ['b', 'a']);
  assert.equal(first, true);
  ({ session } = answer(session, true));
  ({ session, first } = answer(session, false));
  assert.equal(first, false, 'only the first answer moves the word');
  assert.deepEqual(session.queue, []);
});

test('a session is capped', () => {
  const many = Array.from({ length: 50 }, (_, n) => `w${n}`);
  assert.equal(startSession(many).queue.length, 20);
});
