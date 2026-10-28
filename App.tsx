import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { dueCount, openDatabases, type Databases } from './src/db';
import { GamesScreen } from './src/screens/GamesScreen';
import { ListScreen } from './src/screens/ListScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { WordScreen } from './src/screens/WordScreen';
import { serif, useTheme } from './src/theme';

type Screen =
  | { name: 'search' } | { name: 'review' } | { name: 'game' } | { name: 'list' }
  | { name: 'word'; typed: string };

export default function App() {
  const theme = useTheme();
  const [db, setDb] = useState<Databases | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'search' });
  const [due, setDue] = useState(0);
  // Bumped by every grafia://buscar, so the search screen remounts empty and
  // focused even when it was already open with an old word.
  const [searchKey, setSearchKey] = useState(0);

  useEffect(() => {
    openDatabases().then(setDb);
  }, []);

  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (url?.startsWith('grafia://buscar')) {
        setScreen({ name: 'search' });
        setSearchKey((n) => n + 1);
      }
    };
    Linking.getInitialURL().then(open);
    const subscription = Linking.addEventListener('url', ({ url }) => open(url));
    return () => subscription.remove();
  }, []);

  const refreshDue = useCallback(() => {
    if (db) dueCount(db.captures).then(setDue);
  }, [db]);

  useEffect(refreshDue, [refreshDue, screen]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.app, { backgroundColor: theme.background }]}>
        <StatusBar style="auto" />
        {!db ? (
          <View style={styles.loading}>
            <Text style={[styles.brand, { color: theme.text }]}>Grafía</Text>
            <Text style={[styles.loadingText, { color: theme.muted }]}>Preparando el diccionario…</Text>
          </View>
        ) : (
          <>
            <Tabs screen={screen} due={due} onChange={setScreen} />
            {screen.name === 'search' && <SearchScreen key={searchKey} db={db} onSaved={refreshDue} />}
            {screen.name === 'review' && <ReviewScreen db={db} onAnswered={refreshDue} />}
            {screen.name === 'game' && <GamesScreen db={db} />}
            {screen.name === 'list' && (
              <ListScreen db={db} onOpen={(typed) => setScreen({ name: 'word', typed })} />
            )}
            {screen.name === 'word' && (
              <WordScreen db={db} typed={screen.typed} onClose={() => setScreen({ name: 'list' })} />
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type TabsProps = { screen: Screen; due: number; onChange: (screen: Screen) => void };

function Tabs({ screen, due, onChange }: TabsProps) {
  const theme = useTheme();
  const current = screen.name === 'word' ? 'list' : screen.name;
  const tabs = [
    { name: 'search', label: 'Buscar' },
    { name: 'review', label: 'Repasar' },
    { name: 'game', label: 'Jugar' },
    { name: 'list', label: 'Guardadas' },
  ] as const;
  return (
    <View style={[styles.tabs, { backgroundColor: theme.surface }]}>
      {tabs.map((tab) => {
        const active = tab.name === current;
        return (
          <Pressable
            key={tab.name}
            onPress={() => onChange({ name: tab.name })}
            style={[styles.tab, active && { backgroundColor: theme.background }]}
          >
            <Text style={[styles.tabText, { color: active ? theme.text : theme.muted }]}>{tab.label}</Text>
            {tab.name === 'review' && due > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={[styles.badgeText, { color: theme.onAccent }]}>{due}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  brand: { fontFamily: serif, fontSize: 40, marginBottom: 12 },
  loadingText: { fontSize: 16 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginTop: 6, marginBottom: 10, padding: 3, borderRadius: 12 },
  tab: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 10,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
