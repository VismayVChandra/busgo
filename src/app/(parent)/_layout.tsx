import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function ParentLayout() {
  const { profile } = useAuth();

  if (profile?.role !== 'parent') return <Redirect href="/" />;

  return (
    <Stack>
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="join" options={{ presentation: 'modal', headerShown: true, title: 'Add a child' }} />
    </Stack>
  );
}
