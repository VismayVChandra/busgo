/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F9F6EC',
    surface: '#FDFDFC',
    backgroundElement: '#DFECE2',
    backgroundSelected: '#DFECE2',
    border: '#E2DED5',
    text: '#214B4D',
    textSecondary: '#52706D',
    primary: '#17666B',
    primaryForeground: '#F9F6EC',
    accent: '#E8A936',
    accentForeground: '#20343C',
    error: '#C3392C',
    errorForeground: '#F9F6EC',
    success: '#4C8C6B',
    successForeground: '#F9F6EC',
  },
  dark: {
    background: '#152228',
    surface: '#1C2B31',
    backgroundElement: '#2A4A46',
    backgroundSelected: '#2A4A46',
    border: '#30434B',
    text: '#FBF9F4',
    textSecondary: '#C0B8A5',
    primary: '#3CCBD3',
    primaryForeground: '#152228',
    accent: '#F2B450',
    accentForeground: '#152228',
    error: '#D6584C',
    errorForeground: '#FBF9F4',
    success: '#6FBE95',
    successForeground: '#152228',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  displayMedium: 'Fraunces_500Medium',
  displaySemiBold: 'Fraunces_600SemiBold',
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', android: 'monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const CardShadow = Platform.select({
  ios: { shadowColor: '#1F4041', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
  default: {},
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
