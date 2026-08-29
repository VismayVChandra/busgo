import { Play, Square } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  isActive: boolean;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
};

export function TripControls({ isActive, busy, onStart, onEnd }: Props) {
  const theme = useTheme();

  return (
    <Button
      label={isActive ? 'End trip' : 'Start trip'}
      onPress={isActive ? onEnd : onStart}
      loading={busy}
      variant={isActive ? 'danger' : 'primary'}
      icon={
        isActive ? (
          <Square size={16} color={theme.errorForeground} />
        ) : (
          <Play size={16} color={theme.primaryForeground} />
        )
      }
    />
  );
}
