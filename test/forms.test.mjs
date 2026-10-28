// Runs every case in grafia-corpus/tests/forms.txt through src/lookup.ts,
// against the same dictionary.db the app bundles. The Python build passes these
// too, so both halves answer to one spec.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { canonical, lookup, stripAccents, suggest } from '../src/lookup.ts';

const FORMS = new URL('../../grafia-corpus/tests/forms.txt', import.meta.url);
const db = new DatabaseSync(new URL('../assets/dictionary.db', import.meta.url).pathname, { readOnly: true });
const query = async (sql, params) => db.prepare(sql).all(...params);

const hasEntry = (lemma) => Boolean(db.prepare('SELECT 1 FROM entry WHERE lemma = ?').get(lemma));
const parts = (text, separator) => text.split(separator).map((part) => part.trim());

const cases = readFileSync(FORMS, 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => parts(line, '->'));

for (const [form, expected] of cases) {
  test(form, async () => {
    const found = (await lookup(query, form)).map((result) => result.lemma);
    if (expected === 'NONE') {
      assert.deepEqual(found, []);
    } else if (expected.includes('&')) {
      assert.deepEqual(new Set(found), new Set(parts(expected, '&')));
    } else if (expected.includes('>>')) {
      const [own, fallback] = parts(expected, '>>');
      assert.deepEqual(found, [hasEntry(own) ? own : fallback]);
    } else {
      assert.deepEqual(found, [expected]);
    }
  });
}

test('ñ and ü survive, accents do not', () => {
  assert.equal(stripAccents('Cañón'), 'cañon');
  assert.equal(stripAccents('pingüino'), 'pingüino');
  assert.equal(stripAccents('efímero'), 'efimero');
});

test('suggestions ignore accents and resolve to their lemma', async () => {
  const [first] = await suggest(query, 'efim');
  assert.deepEqual(first, { key: 'efímero', lemma: 'efímero' });
  const eones = (await suggest(query, 'eone')).find(({ key }) => key === 'eones');
  assert.equal(eones?.lemma, 'eón');
});

test('a word typed without accents is saved with them', async () => {
  assert.equal(await canonical(query, 'licito'), 'lícito');
  assert.equal(await canonical(query, 'Vino'), 'vino');
  assert.equal(await canonical(query, 'qwertyuiop'), 'qwertyuiop');
});
