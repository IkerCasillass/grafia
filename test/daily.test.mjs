import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fileUrl, isDate, mexicoDate, parseDaily } from '../src/daily.ts';

const file = {
  date: '2026-11-03',
  from: '2026-11-03T06:00:00Z',
  until: '2026-11-04T06:00:00Z',
  word: { lemma: 'crisálida', pos: 'noun', definition: 'Etapa de la oruga.',
          example: null, etymology: null, syllables: ['cri', 'sá', 'li', 'da'] },
};

test('the day turns at midnight in Mexico City, not at midnight UTC', () => {
  // 23:30 in Mexico on the 3rd is already the 4th in UTC.
  assert.equal(mexicoDate(new Date('2026-11-04T05:30:00Z')), '2026-11-03');
  assert.equal(mexicoDate(new Date('2026-11-04T06:00:00Z')), '2026-11-04');
});

test('the file lives at palabra/<date>.json', () => {
  assert.equal(fileUrl('2026-11-03', 'https://x.dev'), 'https://x.dev/palabra/2026-11-03.json');
});

test('only a real date becomes a path', () => {
  assert.ok(isDate('2026-11-03'));
  for (const bad of ['../../etc', '2026-11-3', '2026-11-03/x', '']) assert.ok(!isDate(bad), bad);
});

test('a well-formed file parses', () => {
  assert.equal(parseDaily(file)?.word.lemma, 'crisálida');
});

test('a malformed file is refused, not half-shown', () => {
  assert.equal(parseDaily(null), null);
  assert.equal(parseDaily({ ...file, word: { ...file.word, definition: '' } }), null);
  assert.equal(parseDaily({ ...file, date: '../x' }), null);
  assert.equal(parseDaily({ ...file, word: { ...file.word, example: 42 } }), null);
});
