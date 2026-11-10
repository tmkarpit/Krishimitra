import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { toggleSpeak, useSpeaker } from '@/lib/speech';
import { colors, font, radius, spacing } from '@/theme';

/** 🔊 Listen / ⏹ Stop toggle. `id` must be unique per text block on screen. */
export function SpeakButton({ id, text, compact }: { id: string; text: string; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const speaking = useSpeaker((s) => s.speakingId === id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? t('common.stop') : t('common.listen')}
      hitSlop={8}
      onPress={() => void toggleSpeak(id, text, i18n.language)}
      style={({ pressed }) => [styles.button, speaking && styles.active, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={speaking ? 'stop-circle' : 'volume-high'} size={20} color={speaking ? colors.white : colors.primary} />
      {compact ? null : <Text style={[styles.text, speaking && { color: colors.white }]}>{speaking ? t('common.stop') : t('common.listen')}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  active: { backgroundColor: colors.primary },
  text: { color: colors.primary, fontWeight: '700', fontSize: font.small + 1 },
});
