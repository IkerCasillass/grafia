import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chooseSense, dueWords, getCapture, nextReview, recordAnswer, type Databases } from '../db';
import { Entries } from '../Entries';
import { lookup, type Result } from '../lookup';
import { answer, startSession, type Session } from '../review';
import { serif, useTheme } from '../theme';

type Next = { due: Date; words: number } | null;

export function ReviewScreen({ db, onAnswered }: { db: Databases; onAnswered: () => void }) {
  const theme = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [turn, setTurn] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [next, setNext] = useState<Next>(null);

  useEffect(() => {
    dueWords(db.captures).then((due) => {
      setSession(startSession(due));
    });
  }, [db]);

  const current = session?.queue[0];

  useEffect(() => {
    if (!current) {
      nextReview(db.captures).then(setNext);
      return;
    }
    setRevealed(false);
    lookup(db.dictionary, current).then(setResults);
    getCapture(db.captures, current).then((capture) => setChosen(capture?.sense ?? null));
  }, [db, current, turn]);

  if (!session) return null;

  if (!current) {
    return (
      <View style={styles.done}>
        <Text style={[styles.doneTitle, { color: theme.text }]}>
          {reviewed > 0 ? 'Listo por hoy' : 'Nada que repasar'}
        </Text>
        <Text style={[styles.doneText, { color: theme.muted }]}>
          {reviewed > 0 ? `Repasaste ${reviewed} ${reviewed === 1 ? 'palabra' : 'palabras'}. ` : ''}
          {next ? `${when(next.due)} te ${next.words === 1 ? 'espera una' : `esperan ${next.words}`}.` : 'Las palabras que busques aparecen aquí.'}
        </Text>
      </View>
    );
  }

  const respond = async (knew: boolean) => {
    const { session: after, first } = answer(session, knew);
    await recordAnswer(db.captures, current, knew, first);
    if (first) setReviewed((n) => n + 1);
    setSession(after);
    setTurn((n) => n + 1);
    onAnswered();
  };

  const choose = async (lemma: string, sense: string) => {
    await chooseSense(db.captures, current, lemma, sense);
    setChosen(sense);
  };

  return (
    <View style={styles.screen}>
      <Text style={[styles.progress, { color: theme.muted }]}>
        {session.queue.length === 1 ? 'Última' : `Quedan ${session.queue.length}`}
      </Text>
      <ScrollView contentContainerStyle={styles.card}>
        <Text style={[styles.word, { color: theme.text }]}>{current}</Text>
        {!revealed && (
          <Text style={[styles.prompt, { color: theme.muted }]}>¿Recuerdas qué significa?</Text>
        )}
        {revealed && (
          <Entries query={db.dictionary} typed={current} results={results} chosen={chosen} onChoose={choose} focused />
        )}
      </ScrollView>
      <View style={styles.actions}>
        {!revealed ? (
          <Button label="Ver significado" onPress={() => setRevealed(true)} primary />
        ) : (
          <>
            <Button label="Otra vez" onPress={() => respond(false)} />
            <Button label="La sabía" onPress={() => respond(true)} primary />
          </>
        )}
      </View>
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function when(due: Date): string {
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  if (days === 1) return 'Mañana';
  const date = due.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return `El ${date}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  progress: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  card: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24 },
  word: { fontFamily: serif, fontSize: 42, textAlign: 'center', marginBottom: 12 },
  prompt: { fontSize: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  button: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  done: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  doneTitle: { fontFamily: serif, fontSize: 32, textAlign: 'center', marginBottom: 12 },
  doneText: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
});
