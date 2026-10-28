import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cacheDaily, cachedDaily, getCapture, saveCapture, type Databases } from '../db';
import { fileUrl, parseDaily, type DailyWord } from '../daily';
import { Entries } from '../Entries';
import { lookup, posLabel, type Result } from '../lookup';
import { serif, useTheme } from '../theme';

type Props = { db: Databases; date: string; onClose: () => void };
type Load = 'loading' | 'ready' | 'unavailable';

// Opened from the widget. Unlike a word met in a book, saving is a choice:
// CAPTURA.md §8b.
export function DailyWordScreen({ db, date, onClose }: Props) {
  const theme = useTheme();
  const [daily, setDaily] = useState<DailyWord | null>(null);
  const [state, setState] = useState<Load>('loading');
  const [results, setResults] = useState<Result[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let stale = false;
    const show = async (word: DailyWord) => {
      const [found, capture] = await Promise.all([
        lookup(db.dictionary, word.word.lemma), getCapture(db.captures, word.word.lemma)]);
      if (stale) return;
      setDaily(word);
      setResults(found);
      setSaved(Boolean(capture));
      setState('ready');
    };
    (async () => {
      // The cached copy shows at once, offline included; the network only refreshes it.
      const cached = await cachedDaily(db.captures, date);
      const fromCache = cached ? parseDaily(JSON.parse(cached)) : null;
      if (fromCache) await show(fromCache);
      try {
        const response = await fetch(fileUrl(date));
        const fresh = response.ok ? parseDaily(await response.json()) : null;
        if (fresh) {
          await cacheDaily(db.captures, date, JSON.stringify(fresh));
          await show(fresh);
        } else if (!fromCache && !stale) {
          setState('unavailable');
        }
      } catch {
        if (!fromCache && !stale) setState('unavailable');
      }
    })();
    return () => {
      stale = true;
    };
  }, [db, date]);

  const save = async () => {
    if (!daily || saved) return;
    await saveCapture(db.captures, daily.word.lemma, 'daily');
    setSaved(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[styles.action, { color: theme.accent }]}>‹ Buscar</Text>
        </Pressable>
      </View>
      {state === 'loading' && <View style={styles.flex} />}
      {state === 'unavailable' && (
        <View style={styles.centered}>
          <Text style={[styles.body, { color: theme.muted }]}>
            No se pudo cargar la palabra del día. Revisa tu conexión e inténtalo de nuevo.
          </Text>
        </View>
      )}
      {state === 'ready' && daily && (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.kicker, { color: theme.muted }]}>Palabra del día</Text>
            <Text style={[styles.word, { color: theme.text }]}>{daily.word.lemma}</Text>
            {daily.word.pos && posLabel(daily.word.pos) && (
              <Text style={[styles.pos, { color: theme.muted }]}>{posLabel(daily.word.pos)}</Text>
            )}
            <Text style={[styles.definition, { color: theme.text }]}>{daily.word.definition}</Text>
            {daily.word.example && (
              <Text style={[styles.example, { color: theme.muted }]}>«{daily.word.example}»</Text>
            )}
            {daily.word.etymology && (
              <Text style={[styles.etymology, { color: theme.muted }]}>{daily.word.etymology}</Text>
            )}
            {results.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.muted }]}>En el diccionario</Text>
                <Entries
                  query={db.dictionary} typed={daily.word.lemma} results={results}
                  chosen={null} onChoose={() => undefined}
                />
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={save}
              disabled={saved}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: saved ? theme.surface : theme.accent },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.buttonText, { color: saved ? theme.muted : theme.onAccent }]}>
                {saved ? 'Guardada ✓' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20 },
  action: { fontSize: 16, fontWeight: '600', paddingVertical: 10 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  kicker: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  word: { fontFamily: serif, fontSize: 42, marginTop: 6 },
  pos: { fontSize: 15, fontStyle: 'italic', marginBottom: 12 },
  definition: { fontSize: 20, lineHeight: 28, marginTop: 4 },
  example: { fontSize: 17, lineHeight: 25, fontStyle: 'italic', marginTop: 16 },
  etymology: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  section: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 32, marginBottom: 4,
  },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  button: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  body: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
});
