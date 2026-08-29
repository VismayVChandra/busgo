import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { School, Truck, UserRound } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/types/database';

const ROLE_OPTIONS: { value: Role; label: string; Icon: typeof UserRound }[] = [
  { value: 'parent', label: 'Parent', Icon: UserRound },
  { value: 'driver', label: 'Driver', Icon: Truck },
  { value: 'school', label: 'School', Icon: School },
];

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
          <TextField placeholder="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        )}

        <TextField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

        {mode === 'signUp' && (
          <ThemedView style={styles.roleRow}>
            {ROLE_OPTIONS.map(({ value, label, Icon }) => {
              const selected = role === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRole(value)}
                  style={[
                    styles.roleOption,
                    { borderColor: selected ? theme.primary : theme.border },
                    selected && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <Icon size={20} color={selected ? theme.primary : theme.textSecondary} />
                  <ThemedText type="smallBold" style={styles.roleOptionText}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>
        )}

        {error && (
          <ThemedText type="small" themeColor="error" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Button
          label={mode === 'signIn' ? 'Sign in' : 'Create account'}
          onPress={handleSubmit}
          loading={loading}
          disabled={!email || !password}
        />

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <ThemedText type="linkPrimary" style={styles.switchMode}>
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
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  roleOptionText: { textAlign: 'center' },
  error: { textAlign: 'center' },
  switchMode: { textAlign: 'center', marginTop: Spacing.two },
});
