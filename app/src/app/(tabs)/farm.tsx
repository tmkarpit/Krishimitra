import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, Empty, ErrorView, Loading, Row, Screen } from '@/components/ui';
import { useFields, useProfile } from '@/hooks/queries';
import { formatArea } from '@/lib/geo';
import { colors, spacing } from '@/theme';

export default function Farm() {
  const { t } = useTranslation();
  const fields = useFields();
  const unit = useProfile().data?.land_unit ?? 'acre';

  if (fields.isLoading) return <Loading />;

  return (
    <Screen>
      {fields.error ? <ErrorView error={fields.error} onRetry={() => fields.refetch()} /> : null}
      {fields.data?.length === 0 ? (
        <Empty icon="map-outline" title={t('home.noFieldTitle')} body={t('home.noFieldBody')} />
      ) : (
        fields.data?.map((f) => (
          <Card key={f.id} onPress={() => router.push(`/field/${f.id}`)} style={{ gap: spacing.xs }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="subtitle" style={{ flex: 1 }}>{f.name}</AppText>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Row>
            <AppText variant="muted">
              {formatArea(f.area_sq_m, unit)} {t(`units.${unit}`)}
              {f.village ? ` · ${f.village}` : ''}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Badge label={t(`irrigation.${f.irrigation}`)} tone="info" />
            </View>
          </Card>
        ))
      )}
      <Button title={t('farm.add')} icon="add-circle" onPress={() => router.push('/field/new')} />
    </Screen>
  );
}
