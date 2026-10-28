import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chooseSense, deleteCapture, getCapture, getReview, type Databases } from '../db';
import { Entries } from '../Entries';
import { lookup, type Result } from '../lookup';
import { serif, useTheme } from '../theme';

type Props = { db: Databases; typed: string; onClose: () => void };

export function WordScreen({ db, typed, onClose }: Props) {
  const theme = useTheme();
  const [results, setResults] = useState<Result[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [due, setDue] = useState<Date | null>(null);

  useEffect(() => {
    lookup(db.dictionary, typed).then(setResults);
    getCapture(db.captures, typed).then((capture) => setChosen(capture?.sense ?? null));
    getReview(db.captures, typed).then((review) => setDue(review ? new Date(review.due) : null));
  }, [db, typed]);

  const choose = async (lemma: string, sense: string) => {
    await chooseSense(db.captures, typed, lemma, sense);
    setChosen(sense);
  };

  const remove = () =>
    Alert.alert(`¿Borrar «${typed}»?`, 'También sale del repaso.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteCapture(db.captures, typed);
          onClose();
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[styles.action, { color: theme.accent }]}>‹ Guardadas</Text>
        </Pressable>
        <Pressable onPress={remove} hitSlop={12}>
          <Text style={[styles.action, { color: theme.muted }]}>Borrar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: theme.text }]}>{typed}</Text>
        {due && (
          <Text style={[styles.due, { color: theme.muted }]}>
            Próximo repaso: {due <= new Date()
              ? 'hoy'
              : due.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
          </Text>
        )}
        <Entries
          query={db.dictionary} typed={typed} results={results} chosen={chosen} onChoose={choose} withEtymology
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  action: { fontSize: 16, fontWeight: '600', paddingVertical: 10 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  heading: { fontFamily: serif, fontSize: 34, marginTop: 8 },
  due: { fontSize: 13, marginBottom: 6 },
});
