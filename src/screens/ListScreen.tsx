import { useEffect, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { listCaptures, type Capture, type Databases } from '../db';
import { glossesOf, normalize, stripAccents } from '../lookup';
import { serif, useTheme } from '../theme';

export function ListScreen({ db, onOpen }: { db: Databases; onOpen: (typed: string) => void }) {
  const theme = useTheme();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [glosses, setGlosses] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listCaptures(db.captures).then(async (all) => {
      setCaptures(all);
      setGlosses(await glossesOf(db.dictionary, all.flatMap((c) => (c.sense ? [c.sense] : []))));
    });
  }, [db]);

  const needle = stripAccents(normalize(filter));
  const shown = captures.filter((capture) => stripAccents(capture.typed).includes(needle));
  const exportAll = () =>
    Share.share({
      message: JSON.stringify(
        captures.map((c) => ({ ...c, definition: c.sense ? glosses.get(c.sense) ?? null : null })),
        null, 2),
    });

  if (captures.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          Aún no hay palabras. Las que busques en «Buscar» quedan aquí.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={`Buscar en ${captures.length} ${captures.length === 1 ? 'palabra' : 'palabras'}`}
          placeholderTextColor={theme.muted}
          style={[styles.filter, { color: theme.text, backgroundColor: theme.surface }]}
        />
        <Pressable onPress={exportAll} hitSlop={12}>
          <Text style={[styles.action, { color: theme.accent }]}>Exportar</Text>
        </Pressable>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(capture) => capture.typed}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpen(item.typed)}
            style={({ pressed }) => [styles.row, { borderColor: theme.line }, pressed && { opacity: 0.5 }]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.word, { color: theme.text }]}>{item.typed}</Text>
              <Text style={[styles.date, { color: theme.muted }]}>
                {new Date(item.captured_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.preview, { color: item.sense ? theme.muted : theme.accent }]}
            >
              {item.sense ? glosses.get(item.sense) ?? '' : 'Elige la acepción'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  filter: { flex: 1, fontSize: 16, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  action: { fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  word: { fontFamily: serif, fontSize: 20 },
  date: { fontSize: 13 },
  preview: { fontSize: 15, marginTop: 3 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyText: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
});
