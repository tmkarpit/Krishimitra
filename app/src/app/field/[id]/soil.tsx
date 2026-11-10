import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, ChipRow, ErrorView, Input, Loading, Row, Screen } from '@/components/ui';
import { useLatestSoil, useReadSoilCard, useSaveManualSoil } from '@/hooks/queries';
import { pickPhoto, type PhotoSource, uploadPhoto } from '@/lib/upload';
import { spacing } from '@/theme';
import type { SoilProfile } from '@/types/db';

const TEXTURES = ['sandy', 'sandy_loam', 'loamy', 'silty', 'clay_loam', 'clayey'];
type Key = 'n_kg_ha' | 'p_kg_ha' | 'k_kg_ha' | 'ph' | 'organic_carbon_pct';
const KEYS: Key[] = ['n_kg_ha', 'p_kg_ha', 'k_kg_ha', 'ph', 'organic_carbon_pct'];

export default function SoilScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const soil = useLatestSoil(id);
  const readCard = useReadSoilCard(id);
  const [scanning, setScanning] = useState(false);

  async function scan(source: PhotoSource) {
    const uri = await pickPhoto(source);
    if (!uri) return;
    setScanning(true);
    try {
      const path = await uploadPhoto(uri, 'soil-card');
      await readCard.mutateAsync(path);
    } catch {
      // shown through readCard.error
    } finally {
      setScanning(false);
    }
  }

  if (soil.isLoading) return <Loading />;

  return (
    <Screen>
      <Card tone="primary" style={{ gap: spacing.sm }}>
        <AppText variant="subtitle">{t('soil.scanCard')}</AppText>
        <AppText variant="small">{t('soil.scanHint')}</AppText>
        {scanning ? (
          <Loading message={t('soil.scanning')} />
        ) : (
          <Row>
            <Button title={t('common.camera')} icon="camera" onPress={() => scan('camera')} style={{ flex: 1 }} />
            <Button title={t('common.gallery')} icon="images" variant="secondary" onPress={() => scan('gallery')} style={{ flex: 1 }} />
          </Row>
        )}
        {readCard.isSuccess ? <AppText>{t('soil.scanned')}</AppText> : null}
        {readCard.error ? <ErrorView error={readCard.error} /> : null}
      </Card>
      {/* Remount when a new profile arrives (e.g. after scanning) so the inputs show its values. */}
      <ManualForm key={soil.data?.id ?? 'empty'} fieldId={id} initial={soil.data ?? null} />
    </Screen>
  );
}

function ManualForm({ fieldId, initial }: { fieldId: string; initial: SoilProfile | null }) {
  const { t } = useTranslation();
  const save = useSaveManualSoil(fieldId);
  const [values, setValues] = useState<Record<Key, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, initial?.[k] == null ? '' : String(initial[k])])) as Record<Key, string>,
  );
  const [texture, setTexture] = useState<string | null>(initial?.texture ?? null);

  const num = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  async function submit() {
    await save.mutateAsync({
      n_kg_ha: num(values.n_kg_ha),
      p_kg_ha: num(values.p_kg_ha),
      k_kg_ha: num(values.k_kg_ha),
      ph: num(values.ph),
      organic_carbon_pct: num(values.organic_carbon_pct),
      texture,
    });
    router.back();
  }

  const labels: Record<Key, string> = {
    n_kg_ha: `${t('field.nitrogen')} (kg/ha)`,
    p_kg_ha: `${t('field.phosphorus')} (kg/ha)`,
    k_kg_ha: `${t('field.potassium')} (kg/ha)`,
    ph: t('field.ph'),
    organic_carbon_pct: `${t('field.organicCarbon')} (%)`,
  };

  return (
    <>
      <AppText variant="muted">{t('soil.manualHint')}</AppText>
      {KEYS.map((k) => (
        <Input
          key={k}
          label={labels[k]}
          keyboardType="decimal-pad"
          value={values[k]}
          onChangeText={(v) => setValues((prev) => ({ ...prev, [k]: v }))}
        />
      ))}
      <AppText variant="label">{t('field.texture')}</AppText>
      <ChipRow>
        {TEXTURES.map((x) => (
          <Chip key={x} label={t(`texture.${x}`)} selected={texture === x} onPress={() => setTexture(x)} />
        ))}
      </ChipRow>
      {save.error ? <ErrorView error={save.error} /> : null}
      <Button title={t('soil.saveValues')} icon="save" loading={save.isPending} onPress={submit} />
    </>
  );
}
