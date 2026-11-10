import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PhotoPicker } from '@/components/PhotoPicker';
import { SpeakButton } from '@/components/SpeakButton';
import { AppText, Badge, Button, Card, Chip, ChipRow, ErrorView, Input, Loading, ProgressBar, Row, Screen, Stat } from '@/components/ui';
import { useCropName, useCrops, useEstimateValue, useFields, useProfile } from '@/hooks/queries';
import { formatArea, SQ_M_PER_UNIT } from '@/lib/geo';
import { formatINR } from '@/lib/i18n';
import { uploadPhoto } from '@/lib/upload';
import { colors, spacing } from '@/theme';
import type { CropValuation } from '@/types/db';

const COMMON = ['wheat', 'rice', 'cotton', 'soybean', 'maize', 'chickpea', 'mustard', 'sugarcane', 'onion', 'tomato', 'groundnut', 'pigeonpeas'];

export default function ValueScreen() {
  const { t } = useTranslation();
  const fields = useFields();
  useCrops();
  const cropName = useCropName();
  const unit = useProfile().data?.land_unit ?? 'acre';
  const estimate = useEstimateValue();

  const [fieldId, setFieldId] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [area, setArea] = useState('1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CropValuation | null>(null);

  async function run() {
    setUploading(true);
    try {
      const paths = await Promise.all(photos.map((uri) => uploadPhoto(uri, 'valuation')));
      const areaValue = parseFloat(area.replace(',', '.'));
      const v = await estimate.mutateAsync({
        imagePaths: paths,
        fieldId: fieldId ?? undefined,
        cropSlug: crop ?? undefined,
        areaSqM: !fieldId && areaValue > 0 ? areaValue * SQ_M_PER_UNIT[unit] : undefined,
      });
      setResult(v);
    } catch {
      // shown via estimate.error
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || estimate.isPending;

  return (
    <Screen>
      <AppText variant="muted">{t('value.intro')}</AppText>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('value.whichField')}</AppText>
        <ChipRow>
          {fields.data?.map((f) => (
            <Chip key={f.id} label={`${f.name} · ${formatArea(f.area_sq_m, unit)} ${t(`units.${unit}`)}`} selected={fieldId === f.id} onPress={() => setFieldId(f.id)} />
          ))}
          <Chip label={t('value.noField')} selected={fieldId === null} onPress={() => setFieldId(null)} />
        </ChipRow>
        {fieldId === null ? (
          <Input label={`${t('field.area')} (${t(`units.${unit}`)})`} keyboardType="decimal-pad" value={area} onChangeText={setArea} />
        ) : null}
        <AppText variant="label">{t('value.whichCrop')}</AppText>
        <ChipRow>
          <Chip label={t('value.detectCrop')} selected={crop === null} onPress={() => setCrop(null)} />
          {COMMON.map((c) => (
            <Chip key={c} label={cropName(c)} selected={crop === c} onPress={() => setCrop(c)} />
          ))}
        </ChipRow>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('value.photos')}</AppText>
        <AppText variant="small">{t('value.photoHint')}</AppText>
        <PhotoPicker uris={photos} onChange={setPhotos} />
      </Card>

      {busy ? (
        <Loading message={t('value.analysing')} />
      ) : (
        <Button title={t('value.estimate')} icon="cash" disabled={!photos.length} onPress={run} />
      )}
      {estimate.error ? <ErrorView error={estimate.error} /> : null}
      {result ? <ValuationCard v={result} /> : null}
    </Screen>
  );
}

function ValuationCard({ v }: { v: CropValuation }) {
  const { t } = useTranslation();
  const r = v.result;
  const confidence = Math.round(r.confidence * 100);
  const healthTone = v.health === 'good' ? 'primary' : v.health === 'poor' ? 'danger' : 'warning';
  const spoken = [
    r.crop_name_local,
    v.land_type,
    v.value_low_inr != null ? t('value.worth', { low: formatINR(v.value_low_inr), high: formatINR(v.value_high_inr ?? 0) }) : '',
    ...r.observations,
    ...r.advice,
  ].filter(Boolean).join('. ');

  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <AppText style={{ fontSize: 40 }}>{r.crop_emoji}</AppText>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="title">{r.crop_name_local}</AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {v.growth_stage ? <Badge label={t(`value.stage_${v.growth_stage}`)} tone="info" /> : null}
            {v.health ? <Badge label={t(`value.health_${v.health}`)} tone={healthTone} /> : null}
          </Row>
        </View>
      </Row>

      {v.land_type ? (
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('value.landType')}</AppText>
          <AppText>{v.land_type}</AppText>
        </View>
      ) : null}

      {v.value_low_inr != null ? (
        <Card tone="primary" style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('value.estimatedValue')}</AppText>
          <AppText variant="hero" style={{ color: colors.primaryDark }}>
            {formatINR(v.value_low_inr)} – {formatINR(v.value_high_inr ?? 0)}
          </AppText>
          <Row style={{ flexWrap: 'wrap', rowGap: spacing.sm }}>
            <Stat label={t('reco.yield')} value={`${v.expected_yield_q} ${t('reco.quintal')}`} />
            <Stat label={`${t('reco.price')} (${t(`reco.priceSource_${v.price_source ?? 'estimate'}`)})`} value={`${formatINR(v.price_inr_q ?? 0)}/${t('reco.quintal')}`} />
          </Row>
        </Card>
      ) : (
        <AppText variant="muted">{t('value.noValue')}</AppText>
      )}

      <View style={{ gap: spacing.xs }}>
        <AppText variant="small">{t('diagnose.confidence', { value: confidence })}</AppText>
        <ProgressBar value={confidence} color={confidence >= 60 ? colors.primary : colors.accent} />
      </View>
      {r.observations.length ? (
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('diagnose.symptoms')}</AppText>
          {r.observations.map((o) => <AppText key={o}>• {o}</AppText>)}
        </View>
      ) : null}
      {r.advice.length ? (
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('reco.tips')}</AppText>
          {r.advice.map((a) => <AppText key={a}>• {a}</AppText>)}
        </View>
      ) : null}
      <SpeakButton id={`value-${v.id}`} text={spoken} />
      {v.crop_slug && v.expected_yield_q ? (
        <Button title={t('value.sellThis')} icon="storefront" onPress={() => router.push(`/listing/new?valuation=${v.id}`)} />
      ) : null}
      <AppText variant="small" style={{ textAlign: 'center' }}>{t('value.disclaimer')}</AppText>
    </Card>
  );
}
