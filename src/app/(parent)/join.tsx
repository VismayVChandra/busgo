import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { JoinGroupForm } from '@/components/join-group-form';
import { ThemedView } from '@/components/themed-view';

export default function JoinScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <JoinGroupForm onJoined={() => router.back()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
