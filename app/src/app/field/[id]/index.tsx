import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon } from '@/components/Map';
import { WeatherNow } from '@/components/Weather';
import { AppText, Badge, Button, Card, Chip, ChipRow, ErrorView, Loading, Row, Screen, SectionTitle, Stat } from '@/components/ui';
import { useCropName, useDeleteField, useField, useFieldAnalysis, usePlans, useProfile, useRecommend, useRecommendations } from '@/hooks/queries';
import { formatArea, regionFor } from '@/lib/geo';
import { formatDate } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme';
import type { Season, SoilProfile } from '@/types/db';

const SEASONS: Season[] = ['kharif', 'rabi', 'zaid'];

export default function FieldDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const field = useField(id);
  const analysis = useFieldAnalysis(id);
  const recs = useRecommendations(id);
  const plans = usePlans(id);
  const recommend = useRecommend();
  const remove = useDeleteField();
  const cropName = useCropName();
  const unit = useProfile().data?.land_unit ?? 'acre';
  const [season, setSeason] = useState<Season | null>(null);

  if (field.isLoading) return <Loading />;
  if (!field.data) return <Screen><ErrorView error={field.error} onRetry={() => field.refetch()} /></Screen>;
  const f = field.data;
  const chosenSeason = season ?? analysis.data?.season ?? 'kharif';
  const points = f.boundary_coords ?? [];

  async function getAdvice() {
    const rec = await recommend.mutateAsync({ fieldId: f.id, season: chosenSeason });
    router.push(`/recommendation/${rec.id}`);
  }

  function confirmDelete() {
    Alert.alert(t('field.deleteField'), t('field.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(f.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: f.name }} />
      <View style={styles.map}>
        <MapView style={StyleSheet.absoluteFill} mapType="hybrid" region={regionFor(points, { latitude: f.lat, longitude: f.lng })} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}>
          {points.length >= 3 ? (
            <Polygon coordinates={points} strokeColor={colors.accent} fillColor="rgba(249,168,37,0.3)" strokeWidth={3} />
          ) : (
            <Marker coordinate={{ latitude: f.lat, longitude: f.lng }} />
          )}
        </MapView>
      </View>
      <Row style={{ flexWrap: 'wrap' }}>
        <Stat label={t('field.area')} value={`${formatArea(f.area_sq_m, unit)} ${t(`units.${unit}`)}`} />
        <Stat label={t('field.irrigationLabel')} value={t(`irrigation.${f.irrigation}`)} />
      </Row>
      {f.village || f.district ? <AppText variant="muted">{[f.village, f.district].filter(Boolean).join(', ')}</AppText> : null}

      {/* Crop advice ------------------------------------------------------ */}
      <Card tone="primary" style={{ gap: spacing.md }}>
        <AppText variant="subtitle">{t('field.getAdvice')}</AppText>
        <ChipRow>
          {SEASONS.map((s) => (
            <Chip key={s} label={t(`season.${s}`)} selected={chosenSeason === s} onPress={() => setSeason(s)} />
          ))}
        </ChipRow>
        {recommend.isPending ? (
          <Loading message={t('field.recommending')} />
        ) : (
          <Button title={t('field.getAdvice')} icon="sparkles" onPress={getAdvice} disabled={!analysis.data && analysis.isLoading} />
        )}
        {recommend.error ? <ErrorView error={recommend.error} /> : null}
      </Card>

      {plans.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t('field.plans')}</SectionTitle>
          {plans.data.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/plan/${p.id}`)} style={styles.listRow}>
              <AppText style={{ fontSize: 28 }}>{p.crops?.emoji ?? '🌱'}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="subtitle">{p.guidance?.crop_local_name || cropName(p.crops?.slug)}</AppText>
                <AppText variant="small">{t('plan.sown', { date: formatDate(p.sowing_date, i18n.language) })}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Card>
          ))}
        </View>
      ) : null}

      {/* Soil + weather ---------------------------------------------------- */}
      {analysis.isLoading ? <Card><Loading message={t('field.analysing')} /></Card> : null}
      {analysis.error ? <ErrorView error={analysis.error} onRetry={() => analysis.refetch()} /> : null}
      {analysis.data ? (
        <>
          <SoilCard soil={analysis.data.soil} onEdit={() => router.push(`/field/${f.id}/soil`)} />
          <WeatherNow weather={analysis.data.weather} />
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="label">{t('field.climate')}</AppText>
            <AppText>{t('field.seasonRain', { season: t(`season.${analysis.data.season}`), mm: Math.round(analysis.data.season_climate.rain_mm) })}</AppText>
            <AppText>{t('field.avgTemp', { temp: analysis.data.season_climate.temp_mean })}</AppText>
          </Card>
        </>
      ) : null}

      {recs.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t('field.pastAdvice')}</SectionTitle>
          {recs.data.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/recommendation/${r.id}`)} style={styles.listRow}>
              <AppText style={{ fontSize: 22 }}>{r.results.slice(0, 3).map((c) => c.emoji).join(' ')}</AppText>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>{r.results.slice(0, 3).map((c) => c.local_name).join(', ')}</AppText>
                <AppText variant="small">{t(`season.${r.season}`)} · {formatDate(r.created_at, i18n.language)}</AppText>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Button title={t('field.deleteField')} icon="trash-outline" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
    </Screen>
  );
}

function SoilCard({ soil, onEdit }: { soil: SoilProfile | null; onEdit: () => void }) {
  const { t } = useTranslation();
  const value = (v: number | null | undefined, suffix = '') => (v == null ? t('field.notTested') : `${v}${suffix}`);
  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="subtitle">{t('field.soil')}</AppText>
        {soil ? <Badge label={t(`field.soilSource.${soil.source}`)} tone={soil.source === 'soilgrids' || soil.source === 'regional' ? 'info' : 'primary'} /> : null}
      </Row>
      {soil ? (
        <View style={styles.soilGrid}>
          <Stat label={t('field.ph')} value={value(soil.ph)} />
          <Stat label={t('field.texture')} value={soil.texture ? t(`texture.${soil.texture}`) : t('field.notTested')} />
          <Stat label={t('field.organicCarbon')} value={value(soil.organic_carbon_pct, '%')} />
          <Stat label={t('field.nitrogen')} value={value(soil.n_kg_ha, ' kg/ha')} />
          <Stat label={t('field.phosphorus')} value={value(soil.p_kg_ha, ' kg/ha')} />
          <Stat label={t('field.potassium')} value={value(soil.k_kg_ha, ' kg/ha')} />
        </View>
      ) : (
        <AppText variant="muted">{t('field.noSoil')}</AppText>
      )}
      {soil?.source === 'soilgrids' || soil?.source === 'regional' ? <AppText variant="small">{t('field.soilEstimateNote')}</AppText> : null}
      <Button title={t('field.updateSoil')} icon="flask" variant="secondary" onPress={onEdit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  map: { height: 200, borderRadius: radius.lg, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  soilGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
});
