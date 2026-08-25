import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { profile } = useAuth();

  if (profile?.role !== 'admin') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
