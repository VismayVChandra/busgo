import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function DriverLayout() {
  const { profile } = useAuth();

  if (profile?.role !== 'driver') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
