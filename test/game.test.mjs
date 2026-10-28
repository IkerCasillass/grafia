import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROUNDS, buildQuestion, maskGloss, pickTargets } from '../src/game.ts';

const word = (typed, pos = 'adj', box = 0, lemma = typed) =>
  ({ typed, lemma, pos, box, gloss: `definición de ${typed}` });

test('the definition never names the answer', () => {
  assert.equal(maskGloss('Que zahiere o es propio de zaherir.', ['zaherir']), 'Que zahiere o es propio de ….');
  assert.equal(maskGloss('Oscuro, tenebroso.', ['lóbrego']), 'Oscuro, tenebroso.');
  assert.equal(maskGloss('Extirpación de las amígdalas.', ['amigdalectomía']), 'Extirpación de las ….');
});

test('distractors share the part of speech and never repeat the answer', () => {
  const target = word('lóbrego');
  const saved = [target, word('aciago'), word('zaherir', 'verb'), word('rutilante'), word('lóbregas', 'adj', 0, 'lóbrego')];
  const question = buildQuestion(target, saved, ['diáfano', 'taciturno'], () => 0.5);
  assert.equal(question.options.length, 4);
  assert.ok(question.options.includes('lóbrego'));
  assert.ok(!question.options.includes('zaherir'), 'a verb among adjectives gives itself away');
  assert.ok(!question.options.includes('lóbregas'), 'another form of the answer is also right');
  assert.equal(new Set(question.options).size, 4);
});

test('the dictionary fills in when few words are saved', () => {
  const question = buildQuestion(word('lóbrego'), [], ['diáfano', 'taciturno', 'aciago', 'efímero']);
  assert.equal(question.options.length, 4);
});

test('low boxes come first, and a game has at most ten rounds', () => {
  const words = Array.from({ length: 15 }, (_, n) => word(`w${n}`, 'adj', n % 3));
  const picked = pickTargets(words);
  assert.equal(picked.length, ROUNDS);
  assert.ok(picked.slice(0, 5).every((w) => w.box === 0));
});

test('two saved forms of one lemma are one round, the one in the lower box', () => {
  const words = [word('lóbregas', 'adj', 2, 'lóbrego'), word('lóbrego', 'adj', 0), word('aciago')];
  const picked = pickTargets(words);
  assert.deepEqual(picked.map((w) => w.typed).sort(), ['aciago', 'lóbrego']);
});

test('the spelling game knows which capture it is asking for', async () => {
  const { buildSpelling } = await import('../src/game.ts');
  assert.equal(buildSpelling(word('lóbregas', 'adj', 0, 'lóbrego')).typed, 'lóbregas');
});

test('spelling: exact is right, a missing tilde is close, anything else is wrong', async () => {
  const { checkSpelling } = await import('../src/game.ts');
  assert.equal(checkSpelling(' Lóbrego ', ['lóbrego']), 'right');
  assert.equal(checkSpelling('lobrego', ['lóbrego']), 'accent');
  assert.equal(checkSpelling('lobrégo', ['lóbrego']), 'accent');
  assert.equal(checkSpelling('lúbrego', ['lóbrego']), 'wrong');
  assert.equal(checkSpelling('lóbrega', ['lóbrego']), 'wrong');
  assert.equal(checkSpelling('eones', ['eón', 'eones']), 'right');
});

test('ñ is a letter, not an accent', async () => {
  const { checkSpelling } = await import('../src/game.ts');
  assert.equal(checkSpelling('guinapo', ['guiñapo']), 'wrong');
});

test('the pattern shows one slot per letter', async () => {
  const { letterPattern } = await import('../src/game.ts');
  assert.equal(letterPattern('eón', 1), 'e _ _');
  assert.equal(letterPattern('guiñapo', 4), 'g u i ñ _ _ _');
});
