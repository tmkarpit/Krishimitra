import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { SpeakButton } from '@/components/SpeakButton';
import { AppText, Button, Card, ErrorView, Loading, Screen } from '@/components/ui';
import { useSchemes } from '@/hooks/queries';
import { spacing } from '@/theme';
import type { Scheme } from '@/types/db';

export default function SchemesScreen() {
  const { t, i18n } = useTranslation();
  const schemes = useSchemes();
  const [open, setOpen] = useState<string | null>(null);

  if (schemes.isLoading) return <Loading />;
  if (schemes.error) return <Screen><ErrorView error={schemes.error} onRetry={() => schemes.refetch()} /></Screen>;

  const translate = (s: Scheme) =>
    s.scheme_translations.find((x) => x.language_code === i18n.language) ??
    s.scheme_translations.find((x) => x.language_code === 'hi' && i18n.language !== 'en') ??
    s.scheme_translations.find((x) => x.language_code === 'en') ??
    s.scheme_translations[0];

  return (
    <Screen>
      {schemes.data?.map((s) => {
        const tr = translate(s);
        if (!tr) return null;
        const expanded = open === s.id;
        const sections = [
          [t('schemes.benefits'), tr.benefits],
          [t('schemes.eligibility'), tr.eligibility],
          [t('schemes.howToApply'), tr.how_to_apply],
        ] as const;
        return (
          <Card key={s.id} onPress={() => setOpen(expanded ? null : s.id)} style={{ gap: spacing.sm }}>
            <AppText variant="subtitle">{tr.title}</AppText>
            <AppText variant="muted">{tr.summary}</AppText>
            {expanded ? (
              <View style={{ gap: spacing.sm }}>
                {sections.map(([label, body]) =>
                  body ? (
                    <View key={label} style={{ gap: 2 }}>
                      <AppText variant="label">{label}</AppText>
                      <AppText>{body}</AppText>
                    </View>
                  ) : null,
                )}
                <SpeakButton id={`scheme-${s.id}`} text={[tr.title, tr.summary, ...sections.map(([l, b]) => (b ? `${l}: ${b}` : ''))].join('. ')} />
                <Button title={t('schemes.open')} icon="open-outline" variant="secondary" onPress={() => Linking.openURL(s.official_url)} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
