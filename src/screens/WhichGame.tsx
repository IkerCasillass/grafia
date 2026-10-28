import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { logPlay, playableCaptures, type Databases } from '../db';
import { buildQuestion, pickTargets, shuffle, type Playable, type Question } from '../game';
import { lookup, randomLemmas, senseById, sensesOf } from '../lookup';
import { serif, useTheme } from '../theme';

type Answered = { question: Question; picked: string };

export async function loadPlayable(db: Databases): Promise<Playable[]> {
  const captures = await playableCaptures(db.captures);
  const playable = await Promise.all(captures.map(async ({ typed, lemma, sense: chosen, box }) => {
    const word = (lemma: string, gloss: string, pos: string): Playable => ({ typed, lemma, gloss, pos, box });
    if (chosen && lemma) {
      const sense = await senseById(db.dictionary, chosen);
      if (sense) return word(lemma, sense.gloss, sense.pos);
    }
    // No sense chosen yet: play the first sense of the most frequent reading.
    const [first] = await lookup(db.dictionary, typed);
    if (!first) return null;
    const [sense] = await sensesOf(db.dictionary, first.lemma);
    return sense ? word(first.lemma, sense.gloss, sense.pos) : null;
  }));
  return playable.filter((word) => word !== null);
}

const FILLERS = 12;

// Each randomLemmas call sorts every sense of its part of speech, so draw one
// pool per part of speech and share it out.
async function newGame(db: Databases): Promise<Question[]> {
  const saved = await loadPlayable(db);
  const targets = pickTargets(saved);
  const pools = new Map<string, string[]>();
  for (const pos of new Set(targets.map((target) => target.pos))) {
    const rounds = targets.filter((target) => target.pos === pos).length;
    pools.set(pos, await randomLemmas(db.dictionary, pos, FILLERS * rounds));
  }
  return targets.map((target) => buildQuestion(target, saved, shuffle(pools.get(target.pos)!).slice(0, FILLERS)));
}

export function WhichGame({ db, onExit }: { db: Databases; onExit: () => void }) {
  const theme = useTheme();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  const start = useCallback(() => {
    setQuestions(null);
    setAnswered([]);
    setPicked(null);
    newGame(db).then(setQuestions);
  }, [db]);

  useEffect(start, [start]);

  if (!questions) return null;

  if (questions.length === 0) return <NoWords onExit={onExit} />;

  const round = answered.length;
  if (round === questions.length) {
    const items = answered.map(({ question, picked }) =>
      ({ word: question.answer, gloss: question.gloss, right: picked === question.answer }));
    return <Results items={items} onAgain={start} onExit={onExit} />;
  }

  const question = questions[round];
  const streak = currentStreak(answered.map(({ question, picked }) => picked === question.answer));

  const pick = (option: string) => {
    if (picked) return;
    setPicked(option);
    logPlay(db.captures, 'which', question.answer, option === question.answer);
  };

  const next = () => {
    setAnswered([...answered, { question, picked: picked! }]);
    setPicked(null);
  };

  return (
    <View style={styles.screen}>
      <GameHeader round={round} total={questions.length} streak={streak} onExit={onExit} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.prompt, { color: theme.muted }]}>¿Qué palabra significa…?</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.gloss, { color: theme.text }]}>{question.gloss}</Text>
        </View>
        {question.options.map((option) => {
          const isAnswer = option === question.answer;
          const state = !picked ? 'idle' : isAnswer ? 'right' : option === picked ? 'wrong' : 'other';
          return (
            <Pressable
              key={option}
              onPress={() => pick(option)}
              style={({ pressed }) => [
                styles.option,
                { borderColor: theme.line },
                state === 'right' && { backgroundColor: theme.rightSoft, borderColor: theme.right },
                state === 'wrong' && { backgroundColor: theme.wrongSoft, borderColor: theme.wrong },
                state === 'other' && { opacity: 0.4 },
                pressed && !picked && { opacity: 0.6 },
              ]}
            >
              <Text style={[
                styles.optionText,
                { color: state === 'right' ? theme.right : state === 'wrong' ? theme.wrong : theme.text },
              ]}>
                {option}
              </Text>
              {state === 'right' && <Text style={[styles.mark, { color: theme.right }]}>✓</Text>}
              {state === 'wrong' && <Text style={[styles.mark, { color: theme.wrong }]}>✗</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
      {picked && (
        <View style={styles.footer}>
          <Pressable
            onPress={next}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.buttonText, { color: theme.onAccent }]}>
              {round + 1 === questions.length ? 'Ver resultado' : 'Siguiente'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export type Outcome = { word: string; gloss: string; right: boolean };

export function Results({ items, onAgain, onExit }: { items: Outcome[]; onAgain: () => void; onExit: () => void }) {
  const theme = useTheme();
  const right = items.filter((item) => item.right).length;
  const missed = items.filter((item) => !item.right);
  return (
    <ScrollView contentContainerStyle={styles.results}>
      <Text style={[styles.score, { color: theme.text }]}>{right} de {items.length}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{verdict(right / items.length)}</Text>
      {missed.length > 0 && (
        <>
          <Text style={[styles.section, { color: theme.muted }]}>Para repasar</Text>
          {missed.map((item) => (
            <View key={item.word} style={[styles.missed, { borderColor: theme.line }]}>
              <Text style={[styles.missedWord, { color: theme.text }]}>{item.word}</Text>
              <Text style={[styles.missedGloss, { color: theme.muted }]}>{item.gloss}</Text>
            </View>
          ))}
        </>
      )}
      <Pressable
        onPress={onAgain}
        style={({ pressed }) => [styles.button, styles.again, { backgroundColor: theme.accent }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.buttonText, { color: theme.onAccent }]}>Jugar otra vez</Text>
      </Pressable>
      <Pressable onPress={onExit} hitSlop={12}>
        <Text style={[styles.link, { color: theme.accent }]}>Elegir otro juego</Text>
      </Pressable>
    </ScrollView>
  );
}

type HeaderProps = { round: number; total: number; streak: number; onExit: () => void };

export function GameHeader({ round, total, streak, onExit }: HeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onExit} hitSlop={12}>
        <Text style={[styles.meta, { color: theme.accent }]}>‹ Juegos</Text>
      </Pressable>
      <Text style={[styles.meta, { color: theme.muted }]}>
        {round + 1} de {total}{streak >= 2 ? ` · racha de ${streak}` : ''}
      </Text>
    </View>
  );
}

export function NoWords({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={[styles.body, { color: theme.muted }]}>
        Guarda algunas palabras en «Buscar» para jugar con ellas.
      </Text>
      <Pressable onPress={onExit} hitSlop={12}>
        <Text style={[styles.link, { color: theme.accent }]}>‹ Juegos</Text>
      </Pressable>
    </View>
  );
}

export function currentStreak(answers: boolean[]): number {
  let streak = 0;
  for (let i = answers.length - 1; i >= 0 && answers[i]; i--) streak++;
  return streak;
}

function verdict(share: number): string {
  if (share === 1) return 'Perfecto. Las tienes.';
  if (share >= 0.7) return 'Muy bien.';
  if (share >= 0.4) return 'Vas bien; las que fallaste están abajo.';
  return 'Toca repasarlas otra vez.';
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 },
  meta: { fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  prompt: { fontSize: 15, marginBottom: 10 },
  card: { borderRadius: 14, padding: 18, marginBottom: 20 },
  gloss: { fontFamily: serif, fontSize: 21, lineHeight: 30 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 10,
  },
  optionText: { fontFamily: serif, fontSize: 21 },
  mark: { fontSize: 20, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  button: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  title: { fontFamily: serif, fontSize: 32, textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  results: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  score: { fontFamily: serif, fontSize: 48, textAlign: 'center', marginBottom: 8 },
  section: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 32, marginBottom: 4,
  },
  missed: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  missedWord: { fontFamily: serif, fontSize: 20 },
  missedGloss: { fontSize: 15, lineHeight: 21, marginTop: 2 },
  again: { marginTop: 32 },
  link: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 20 },
});
