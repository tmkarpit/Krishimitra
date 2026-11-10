import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { pickPhoto, type PhotoSource } from '@/lib/upload';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './ui';

/** Row of up to `max` local photo thumbnails with add (camera/gallery) and remove. */
export function PhotoPicker({ uris, onChange, max = 3 }: { uris: string[]; onChange: (uris: string[]) => void; max?: number }) {
  const { t } = useTranslation();

  function add() {
    const pick = async (source: PhotoSource) => {
      const uri = await pickPhoto(source);
      if (uri) onChange([...uris, uri].slice(0, max));
    };
    Alert.alert(t('assistant.attachPhoto'), undefined, [
      { text: t('common.camera'), onPress: () => void pick('camera') },
      { text: t('common.gallery'), onPress: () => void pick('gallery') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.row}>
      {uris.map((uri, i) => (
        <View key={uri}>
          <Image source={{ uri }} style={styles.thumb} />
          <Pressable
            accessibilityLabel={t('common.delete')}
            hitSlop={8}
            style={styles.remove}
            onPress={() => onChange(uris.filter((_, j) => j !== i))}
          >
            <Ionicons name="close-circle" size={24} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      {uris.length < max ? (
        <Pressable accessibilityRole="button" onPress={add} style={[styles.thumb, styles.add]}>
          <Ionicons name="camera" size={30} color={colors.primary} />
          <AppText variant="small">{`${uris.length}/${max}`}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  remove: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.white, borderRadius: 12 },
});
