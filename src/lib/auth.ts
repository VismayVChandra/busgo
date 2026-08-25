import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { Profile } from '@/types/database';

export type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}
