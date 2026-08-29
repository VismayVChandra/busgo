import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function SchoolLayout() {
  const { profile } = useAuth();

  if (profile?.role !== 'school') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
