import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile } = useAuth();

  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.role === 'driver') return <Redirect href="/(driver)/home" />;
  if (profile?.role === 'admin') return <Redirect href="/(admin)/home" />;
  return <Redirect href="/(parent)/home" />;
}
