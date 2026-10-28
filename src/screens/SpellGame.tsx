import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { logPlay, type Databases } from '../db';
import {
  buildSpelling, checkSpelling, letterPattern, pickTargets, type Spelling, type Verdict,
} from '../game';
import { serif, useTheme } from '../theme';
import { GameHeader, NoWords, Results, currentStreak, loadPlayable, styles } from './WhichGame';

type Answered = { spelling: Spelling; verdict: Verdict };

export function SpellGame({ db, onExit }: { db: Databases; onExit: () => void }) {
  const theme = useTheme();
  const [spellings, setSpellings] = useState<Spelling[] | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(1);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const start = useCallback(() => {
    setSpellings(null);
    setAnswered([]);
    loadPlayable(db).then((saved) => setSpellings(pickTargets(saved).map(buildSpelling)));
  }, [db]);

  useEffect(start, [start]);

  if (!spellings) return null;
  if (spellings.length === 0) return <NoWords onExit={onExit} />;

  const round = answered.length;
  if (round === spellings.length) {
    const items = answered.map(({ spelling, verdict }) =>
      ({ word: spelling.answer, gloss: spelling.gloss, right: verdict !== 'wrong' }));
    return <Results items={items} onAgain={start} onExit={onExit} />;
  }

  const spelling = spellings[round];
  const streak = currentStreak(answered.map((a) => a.verdict !== 'wrong'));
  const letters = [...spelling.answer].length;

  const check = () => {
    if (verdict || !text.trim()) return;
    const result = checkSpelling(text, spelling.accepted);
    setVerdict(result);
    logPlay(db.captures, 'spell', spelling.typed, result !== 'wrong');
  };

  const next = () => {
    setAnswered([...answered, { spelling, verdict: verdict! }]);
    setVerdict(null);
    setText('');
    setRevealed(1);
  };

  const color = verdict === 'wrong' ? theme.wrong : verdict ? theme.right : theme.text;

  return (
    <View style={styles.screen}>
      <GameHeader round={round} total={spellings.length} streak={streak} onExit={onExit} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.prompt, { color: theme.muted }]}>Escribe la palabra que significa…</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.gloss, { color: theme.text }]}>{spelling.gloss}</Text>
        </View>
        <Text style={[local.pattern, { color: theme.muted }]}>
          {verdict ? letterPattern(spelling.answer, letters) : letterPattern(spelling.answer, revealed)}
        </Text>
        <TextInput
          key={round}
          autoFocus
          value={text}
          onChangeText={setText}
          onSubmitEditing={verdict ? next : check}
          editable={!verdict}
          returnKeyType={verdict ? 'next' : 'done'}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          blurOnSubmit={false}
          placeholder="Tu respuesta"
          placeholderTextColor={theme.muted}
          style={[local.input, { color, borderColor: verdict ? color : theme.line }]}
        />
        {verdict && (
          <Text style={[local.feedback, { color }]}>
            {verdict === 'right' && '✓ Exacto.'}
            {verdict === 'accent' && `✓ Casi: se escribe «${spelling.answer}».`}
            {verdict === 'wrong' && `✗ Era «${spelling.answer}».`}
          </Text>
        )}
        {!verdict && revealed < letters - 1 && (
          <Pressable onPress={() => setRevealed(revealed + 1)} hitSlop={12}>
            <Text style={[local.hint, { color: theme.accent }]}>Otra letra</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          onPress={verdict ? next : check}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.buttonText, { color: theme.onAccent }]}>
            {!verdict ? 'Comprobar' : round + 1 === spellings.length ? 'Ver resultado' : 'Siguiente'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const local = {
  pattern: { fontFamily: serif, fontSize: 24, letterSpacing: 2, textAlign: 'center' as const, marginBottom: 16 },
  input: { fontFamily: serif, fontSize: 26, borderBottomWidth: 1.5, paddingVertical: 10, textAlign: 'center' as const },
  feedback: { fontSize: 17, fontWeight: '600' as const, textAlign: 'center' as const, marginTop: 14 },
  hint: { fontSize: 15, fontWeight: '600' as const, textAlign: 'center' as const, marginTop: 16 },
};
