import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Databases, Game } from '../db';
import { serif, useTheme } from '../theme';
import { SpellGame } from './SpellGame';
import { WhichGame } from './WhichGame';

const GAMES: { game: Game; title: string; description: string }[] = [
  {
    game: 'which',
    title: '¿Cuál es?',
    description: 'Lees una definición y eliges la palabra entre cuatro.',
  },
  {
    game: 'spell',
    title: 'Escríbela',
    description: 'Lees una definición y escribes la palabra, con todo y tilde.',
  },
];

export function GamesScreen({ db }: { db: Databases }) {
  const theme = useTheme();
  const [game, setGame] = useState<Game | null>(null);
  const exit = () => setGame(null);

  if (game === 'which') return <WhichGame db={db} onExit={exit} />;
  if (game === 'spell') return <SpellGame db={db} onExit={exit} />;

  return (
    <View style={styles.screen}>
      <Text style={[styles.intro, { color: theme.muted }]}>
        Juega con las palabras que guardaste. No cuenta para el repaso.
      </Text>
      {GAMES.map(({ game, title, description }) => (
        <Pressable
          key={game}
          onPress={() => setGame(game)}
          style={({ pressed }) => [styles.card, { backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  intro: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  card: { borderRadius: 16, padding: 20, marginBottom: 12 },
  title: { fontFamily: serif, fontSize: 26, marginBottom: 6 },
  description: { fontSize: 16, lineHeight: 22 },
});
