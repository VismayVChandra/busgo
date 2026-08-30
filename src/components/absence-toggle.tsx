import { useEffect, useState } from 'react';
import { CalendarOff } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { getTodayDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';

type Props = { studentId: string };

export function AbsenceToggle({ studentId }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [absenceId, setAbsenceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = getTodayDateString();
  const [trackedStudentId, setTrackedStudentId] = useState(studentId);

  // Reset during render when studentId changes, rather than in an effect.
  if (studentId !== trackedStudentId) {
    setTrackedStudentId(studentId);
    setChecked(false);
    setAbsenceId(null);
  }

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('absences')
      .select('id')
      .eq('student_id', studentId)
      .eq('absence_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAbsenceId(data?.id ?? null);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, today]);

  async function handleToggle() {
    if (!profile) return;
    setLoading(true);
    if (absenceId) {
      const { error } = await supabase.from('absences').delete().eq('id', absenceId);
      if (!error) setAbsenceId(null);
    } else {
      const { data, error } = await supabase
        .from('absences')
        .insert({ student_id: studentId, absence_date: today, created_by: profile.id })
        .select('id')
        .single();
      if (!error && data) setAbsenceId(data.id);
    }
    setLoading(false);
  }

  if (!checked) return null;

  return (
    <Button
      label={absenceId ? 'Marked absent today — tap to undo' : 'Mark absent today'}
      onPress={handleToggle}
      loading={loading}
      variant={absenceId ? 'secondary' : 'outline'}
      icon={<CalendarOff size={16} color={absenceId ? theme.text : theme.primary} />}
    />
  );
}
