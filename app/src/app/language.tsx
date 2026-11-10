import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { LANGUAGES } from '@/lib/i18n';
import { useSettings } from '@/store/settings';
import { colors, font, radius, spacing } from '@/theme';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useSettings();

  function choose(code: string, native: string, bcp47: string) {
    setLanguage(code);
    void i18n.changeLanguage(code);
    Speech.stop();
    Speech.speak(native, { language: bcp47 });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="leaf" size={44} color={colors.white} />
        <AppText variant="hero" style={{ color: colors.white }}>KrishiMitra</AppText>
        <AppText style={{ color: colors.primaryLight }}>{t('language.title')} · भाषा चुनें</AppText>
      </View>
      <View style={styles.grid}>
        {LANGUAGES.map((l) => {
          const selected = language === l.code;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => choose(l.code, l.native, l.bcp47)}
              style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && { opacity: 0.8 }]}
            >
              <AppText style={[styles.native, selected && { color: colors.white }]}>{l.native}</AppText>
              <AppText variant="small" style={selected ? { color: colors.primaryLight } : undefined}>{l.english}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ padding: spacing.lg }}>
        <Button title={t('common.continue')} icon="arrow-forward" disabled={!language} onPress={() => router.replace('/')} />
        <AppText variant="small" style={{ textAlign: 'center', marginTop: spacing.sm }}>{t('language.subtitle')}</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm, alignContent: 'flex-start' },
  tile: {
    width: '31.5%',
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  tileSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  native: { fontSize: font.large, fontWeight: '700' },
});
