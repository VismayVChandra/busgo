import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/types/database';

export default function LoginScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role } },
          });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Busgo
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          {mode === 'signIn' ? 'Sign in' : 'Create your account'}
        </ThemedText>

        {mode === 'signUp' && (
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Full name"
            placeholderTextColor={theme.textSecondary}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === 'signUp' && (
          <ThemedView style={styles.roleRow}>
            {(['parent', 'driver'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setRole(option)}
                style={[
                  styles.roleOption,
                  { borderColor: theme.backgroundSelected },
                  role === option && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="smallBold" style={styles.roleOptionText}>
                  {option === 'parent' ? "I'm a parent" : "I'm a driver"}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}

        {error && (
          <ThemedText type="small" themeColor="text" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={loading || !email || !password}
          style={[styles.button, { backgroundColor: theme.text, opacity: loading ? 0.6 : 1 }]}>
          {loading ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {mode === 'signIn' ? 'Sign in' : 'Create account'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <ThemedText type="link" themeColor="textSecondary" style={styles.switchMode}>
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  roleOptionText: { textAlign: 'center' },
  error: { textAlign: 'center' },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  switchMode: { textAlign: 'center', marginTop: Spacing.two },
});
