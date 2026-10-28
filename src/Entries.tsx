import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  etymologyOf, posLabel, sensesOf, type Query, type Result, type Sense,
} from './lookup';
import { serif, useTheme } from './theme';

type Props = {
  query: Query;
  typed: string;
  results: Result[];
  chosen: string | null;
  onChoose: (lemma: string, sense: string) => void;
  withEtymology?: boolean;
  // Show only the chosen sense, with a way to open the rest: a review card.
  focused?: boolean;
};

export function Entries({ results, ...props }: Props) {
  const theme = useTheme();
  if (results.length === 0) {
    return (
      <Text style={[styles.miss, { color: theme.muted }]}>
        No está en el diccionario. Quedó guardada; su definición llega después.
      </Text>
    );
  }
  const ambiguous = results.length > 1;
  return (
    <View>
      {ambiguous && !props.chosen && (
        <Text style={[styles.hint, { color: theme.muted }]}>
          Puede ser más de una palabra. Toca la acepción que leíste.
        </Text>
      )}
      {results.map((result) => (
        <Entry key={`${result.lemma}|${result.phrase}`} result={result} {...props} />
      ))}
    </View>
  );
}

type EntryProps = Omit<Props, 'results'> & { result: Result };

function Entry({ query, typed, result, chosen, onChoose, withEtymology, focused }: EntryProps) {
  const theme = useTheme();
  const [senses, setSenses] = useState<Sense[]>([]);
  const [etymology, setEtymology] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    sensesOf(query, result.lemma).then(setSenses);
    if (withEtymology) etymologyOf(query, result.lemma).then(setEtymology);
  }, [query, result.lemma, withEtymology]);

  const holdsChoice = senses.some((sense) => sense.id === chosen);
  if (focused && chosen && !holdsChoice && !expanded) return null;
  const shown = focused && holdsChoice && !expanded
    ? senses.filter((sense) => sense.id === chosen)
    : senses;

  return (
    <View style={[styles.entry, { borderColor: theme.line }]}>
      {result.lemma !== typed && (
        <Text style={[styles.lemma, { color: theme.text }]}>{result.lemma}</Text>
      )}
      {result.phrase && (
        <Text style={[styles.relation, { color: theme.muted }]}>
          {result.phrase} <Text style={styles.base}>{result.base}</Text>
        </Text>
      )}
      {shown.map((sense) => (
        <Pressable
          key={sense.id}
          onPress={() => onChoose(result.lemma, sense.id)}
          style={({ pressed }) => [
            styles.sense,
            sense.id === chosen && { backgroundColor: theme.chosen },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.number, { color: theme.muted }]}>
            {senses.indexOf(sense) + 1}
          </Text>
          <View style={styles.senseBody}>
            {posLabel(sense.pos) && (
              <Text style={[styles.pos, { color: theme.muted }]}>{posLabel(sense.pos)}</Text>
            )}
            <Text style={[styles.gloss, { color: theme.text }]}>{sense.gloss}</Text>
          </View>
          {sense.id === chosen && <Text style={[styles.check, { color: theme.accent }]}>✓</Text>}
        </Pressable>
      ))}
      {shown.length < senses.length && (
        <Pressable onPress={() => setExpanded(true)} hitSlop={8}>
          <Text style={[styles.more, { color: theme.accent }]}>
            Ver las {senses.length} acepciones
          </Text>
        </Pressable>
      )}
      {etymology && (
        <Text style={[styles.etymology, { color: theme.muted }]}>{etymology}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  miss: { fontSize: 17, lineHeight: 25, paddingVertical: 16 },
  hint: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  entry: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  lemma: { fontFamily: serif, fontSize: 24, marginBottom: 2 },
  relation: { fontSize: 15, fontStyle: 'italic', marginBottom: 8 },
  base: { fontFamily: serif, fontStyle: 'normal' },
  sense: {
    flexDirection: 'row', gap: 12, paddingVertical: 10, paddingHorizontal: 10,
    marginHorizontal: -10, borderRadius: 10,
  },
  number: { fontSize: 15, width: 18, textAlign: 'right', paddingTop: 2 },
  senseBody: { flex: 1 },
  pos: { fontSize: 13, fontStyle: 'italic', marginBottom: 2 },
  gloss: { fontSize: 17, lineHeight: 24 },
  check: { fontSize: 18, paddingTop: 1 },
  more: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
  etymology: { fontSize: 14, lineHeight: 20, marginTop: 14 },
});
