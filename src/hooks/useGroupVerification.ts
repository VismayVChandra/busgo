import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { VerificationStatus } from '@/types/database';

/** Live verification status for a group, kept live via Realtime. */
export function useGroupVerification(groupId: string | null | undefined) {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [trackedGroupId, setTrackedGroupId] = useState(groupId);

  // Reset during render when groupId changes, rather than in an effect.
  if (groupId !== trackedGroupId) {
    setTrackedGroupId(groupId);
    setStatus(null);
  }

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    supabase
      .from('groups')
      .select('verification_status')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStatus((data?.verification_status as VerificationStatus) ?? null);
      });

    const channel = supabase
      .channel(`groups:verification:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        (payload) => setStatus((payload.new as { verification_status: VerificationStatus }).verification_status)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return status;
}
