import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { chooseSense, getCapture, listCaptures, saveCapture, type Databases } from '../db';
import { Entries } from '../Entries';
import { canonical, lookup, normalize, suggest, type Result, type Suggestion } from '../lookup';
import { serif, useTheme } from '../theme';

const RECENT = 5;

// Typing shows suggestions; picking one, or pressing search, is the lookup,
// and the lookup is the save. There is no save button: CAPTURA.md §3.
export function SearchScreen({ db, onSaved }: { db: Databases; onSaved: () => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const latest = useRef(0);

  const loadRecent = () =>
    listCaptures(db.captures).then((all) => setRecent(all.slice(0, RECENT).map((c) => c.typed)));

  useEffect(() => {
    loadRecent();
  }, []);

  const type = async (value: string) => {
    setText(value);
    setShown(null);
    const request = ++latest.current;
    const found = await suggest(db.dictionary, value);
    // Keystrokes outrun queries; only the newest answer may land.
    if (request === latest.current) setSuggestions(found);
  };

  const open = async (value: string) => {
    if (!normalize(value)) return;
    latest.current++;
    const word = await canonical(db.dictionary, value);
    Keyboard.dismiss();
    const [found] = await Promise.all([lookup(db.dictionary, word), saveCapture(db.captures, word)]);
    setChosen((await getCapture(db.captures, word))?.sense ?? null);
    setResults(found);
    setText(word);
    setShown(word);
    setSuggestions([]);
    loadRecent();
    onSaved();
  };

  const choose = async (lemma: string, sense: string) => {
    if (!shown) return;
    await chooseSense(db.captures, shown, lemma, sense);
    setChosen(sense);
  };

  const clear = () => {
    latest.current++;
    setText('');
    setShown(null);
    setSuggestions([]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.field, { borderColor: theme.line }]}>
        <TextInput
          autoFocus
          value={text}
          onChangeText={type}
          onSubmitEditing={() => open(text)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          selectTextOnFocus
          placeholder="¿Qué palabra encontraste?"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text }]}
        />
        {text.length > 0 && (
          <Pressable onPress={clear} hitSlop={12} accessibilityLabel="Borrar">
            <Text style={[styles.clear, { color: theme.muted }]}>×</Text>
          </Pressable>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {shown && (
          <>
            <Text style={[styles.heading, { color: theme.text }]}>{shown}</Text>
            <Text style={[styles.saved, { color: theme.muted }]}>Guardada</Text>
            <Entries query={db.dictionary} typed={shown} results={results} chosen={chosen} onChoose={choose} />
          </>
        )}

        {!shown && text.length > 0 && suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.key}
            onPress={() => open(suggestion.key)}
            style={({ pressed }) => [styles.row, { borderColor: theme.line }, pressed && { opacity: 0.5 }]}
          >
            <Text style={[styles.suggestion, { color: theme.text }]}>{suggestion.key}</Text>
            {suggestion.lemma !== suggestion.key && (
              <Text style={[styles.lemma, { color: theme.muted }]}>de {suggestion.lemma}</Text>
            )}
          </Pressable>
        ))}

        {!shown && text.trim().length > 0 && suggestions.length === 0 && (
          <Pressable onPress={() => open(text)} style={[styles.row, { borderColor: theme.line }]}>
            <View>
              <Text style={[styles.suggestion, { color: theme.text }]}>Guardar «{normalize(text)}»</Text>
              <Text style={[styles.lemma, { color: theme.muted }]}>No aparece en el diccionario</Text>
            </View>
          </Pressable>
        )}

        {text.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Escribe la palabra que no conoces. Se guarda sola para repasarla después.
            </Text>
            {recent.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.muted }]}>Recientes</Text>
                {recent.map((word) => (
                  <Pressable key={word} onPress={() => open(word)} style={[styles.row, { borderColor: theme.line }]}>
                    <Text style={[styles.suggestion, { color: theme.text }]}>{word}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  field: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20,
    borderBottomWidth: 1,
  },
  input: { flex: 1, fontFamily: serif, fontSize: 26, paddingVertical: 14 },
  clear: { fontSize: 28, paddingHorizontal: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  heading: { fontFamily: serif, fontSize: 34, marginTop: 18 },
  saved: { fontSize: 13, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestion: { fontFamily: serif, fontSize: 20 },
  lemma: { fontSize: 14, fontStyle: 'italic' },
  empty: { paddingTop: 24 },
  emptyText: { fontSize: 16, lineHeight: 23 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 28 },
});
