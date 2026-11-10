import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Switch } from 'react-native';
import { AppText, Badge, Button, Card, Chip, ChipRow, Loading, Row, Screen } from '@/components/ui';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { LAND_UNITS } from '@/lib/geo';
import { LANGUAGES } from '@/lib/i18n';
import { stopSpeaking } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/store/settings';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const profile = useProfile();
  const update = useUpdateProfile();
  const { language, setLanguage } = useSettings();

  if (!profile.data) return <Loading />;
  const p = profile.data;
  const isGuest = session?.user.is_anonymous;

  return (
    <Screen>
      <Card style={{ gap: spacing.xs }}>
        <AppText variant="title">{p.full_name || t('profile.farmer')}</AppText>
        <Badge label={t(`account.${p.account_type}`)} />
        <AppText variant="muted">{isGuest ? t('profile.guest') : p.phone ? `+${p.phone.replace(/^\+/, '')}` : ''}</AppText>
        {p.village || p.district ? <AppText variant="muted">{[p.village, p.district].filter(Boolean).join(', ')}</AppText> : null}
        <Button title={t('profile.edit')} icon="create-outline" variant="secondary" onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.sm }} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="label">{t('profile.language')}</AppText>
        <ChipRow>
          {LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.native} selected={language === l.code} onPress={() => setLanguage(l.code)} />
          ))}
        </ChipRow>
        <AppText variant="label">{t('onboarding.landUnit')}</AppText>
        <ChipRow>
          {LAND_UNITS.map((u) => (
            <Chip key={u} label={t(`units.${u}`)} selected={p.land_unit === u} onPress={() => update.mutate({ land_unit: u })} />
          ))}
        </ChipRow>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{t('profile.voiceAutoplay')}</AppText>
          <Switch
            value={p.voice_autoplay}
            onValueChange={(v) => update.mutate({ voice_autoplay: v })}
            trackColor={{ true: colors.primary }}
          />
        </Row>
      </Card>

      <Card tone="primary" style={{ gap: spacing.sm }}>
        <AppText>{t('profile.helpline')}</AppText>
        <Button title="1800-180-1551" icon="call" variant="secondary" onPress={() => Linking.openURL('tel:18001801551')} />
      </Card>

      <Button
        title={t('profile.signOut')}
        icon="log-out-outline"
        variant="danger"
        onPress={async () => {
          await stopSpeaking();
          await supabase.auth.signOut();
          router.replace('/');
        }}
      />
      <AppText variant="small" style={{ textAlign: 'center' }}>{t('profile.about')}</AppText>
    </Screen>
  );
}
