import { useEffect, useId, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { GroupMessage } from '@/types/database';

/** Latest broadcast message for a group, kept live via Realtime. */
export function useLatestGroupMessage(groupId: string | null | undefined) {
  const [message, setMessage] = useState<GroupMessage | null>(null);
  const [trackedGroupId, setTrackedGroupId] = useState(groupId);
  // Per-instance suffix so two simultaneous consumers of the same groupId
  // don't share one already-subscribed channel object (see useBoardingStatus).
  const instanceId = useId();

  // Reset during render when groupId changes, rather than in an effect.
  if (groupId !== trackedGroupId) {
    setTrackedGroupId(groupId);
    setMessage(null);
  }

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMessage((data as GroupMessage) ?? null);
      });

    const channel = supabase
      .channel(`group_messages:group:${groupId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => setMessage(payload.new as GroupMessage)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, instanceId]);

  return message;
}
