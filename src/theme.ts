import { Platform, useColorScheme } from 'react-native';

const light = {
  background: '#faf8f4',
  surface: '#f2eee6',
  text: '#1d1b18',
  muted: '#6f6a62',
  line: '#e4dfd6',
  accent: '#8a4b2a',
  onAccent: '#ffffff',
  chosen: '#f1e6dc',
  right: '#2f6b43',
  rightSoft: '#e3efe5',
  wrong: '#9c3326',
  wrongSoft: '#f5e1dd',
};

// Read in bed, with the lights off: dark mode is not optional here.
const dark: typeof light = {
  background: '#141311',
  surface: '#1e1c19',
  text: '#ece8e1',
  muted: '#9a948a',
  line: '#2c2a26',
  accent: '#d49a72',
  onAccent: '#141311',
  chosen: '#2a211b',
  right: '#8cc79c',
  rightSoft: '#1c2a20',
  wrong: '#e58b7f',
  wrongSoft: '#2e1d1a',
};

export type Theme = typeof light;

export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
