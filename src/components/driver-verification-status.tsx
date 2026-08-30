import { useState } from 'react';
import { StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { CheckCircle2, Clock, Upload, XCircle } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Group, School } from '@/types/database';

type Props = {
  group: Group;
  school: School | null;
};

export function DriverVerificationStatus({ group, school }: Props) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (group.verification_status === 'verified') {
    return (
      <ThemedView style={styles.badgeRow}>
        <CheckCircle2 size={14} color={theme.success} />
        <ThemedText type="small" style={{ color: theme.success }}>
          Verified
        </ThemedText>
      </ThemedView>
    );
  }

  if (group.school_id) {
    return (
      <ThemedView style={[styles.card, { borderColor: theme.border }, CardShadow]}>
        <Clock size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardText}>
          Waiting for {school?.name ?? 'your school'} to verify your group.
        </ThemedText>
      </ThemedView>
    );
  }

  async function handleUpload() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to upload your ID.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Could not read the selected photo');
      return;
    }

    const ext = asset.fileName?.split('.').pop() ?? 'jpg';
    const path = `${group.id}/id-document.${ext}`;

    setUploading(true);
    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(path, decode(asset.base64), { upsert: true, contentType: asset.mimeType ?? 'image/jpeg' });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: rpcError } = await supabase.rpc('submit_driver_document', {
      p_group_id: group.id,
      p_storage_path: path,
    });
    setUploading(false);
    if (rpcError) setError(rpcError.message);
  }

  const isRejected = group.verification_status === 'rejected';
  const isPendingReview = group.verification_status === 'pending' && !!group.id_document_path;

  return (
    <ThemedView style={[styles.card, { borderColor: theme.border }, CardShadow]}>
      {isRejected ? (
        <XCircle size={16} color={theme.error} />
      ) : (
        <Clock size={16} color={theme.textSecondary} />
      )}
      <ThemedView style={styles.cardBody}>
        <ThemedText type="small" themeColor={isRejected ? 'error' : 'textSecondary'}>
          {isRejected
            ? 'Your ID was not approved. Please upload a new photo.'
            : isPendingReview
              ? 'Document submitted — awaiting review.'
              : 'Upload a photo of your license/ID for verification.'}
        </ThemedText>
        {(!isPendingReview || isRejected) && (
          <Button
            label="Upload ID"
            onPress={handleUpload}
            loading={uploading}
            variant="outline"
            icon={<Upload size={14} color={theme.primary} />}
            style={styles.uploadButton}
          />
        )}
      </ThemedView>
      {error && (
        <ThemedText type="small" themeColor="error">
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.half },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cardText: { flex: 1 },
  cardBody: { flex: 1, gap: Spacing.two },
  uploadButton: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
});
