import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function ParentLayout() {
  const { profile } = useAuth();

  if (profile?.role !== 'parent') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
