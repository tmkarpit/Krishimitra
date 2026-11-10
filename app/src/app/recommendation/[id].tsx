import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SpeakButton } from '@/components/SpeakButton';
import { AppText, Badge, Button, Card, Chip, ChipRow, ErrorView, Loading, ProgressBar, Row, Screen, Stat } from '@/components/ui';
import { useCreatePlan, useRecommendation } from '@/hooks/queries';
import { formatINR } from '@/lib/i18n';
import { colors, spacing } from '@/theme';
import type { Recommendation, RecommendedCrop } from '@/types/db';

const RISK_TONE = { low: 'primary', medium: 'warning', high: 'danger' } as const;
const RISK_COLOR = { low: colors.primary, medium: colors.accent, high: colors.danger };

export default function RecommendationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const rec = useRecommendation(id);

  if (rec.isLoading) return <Loading />;
  if (!rec.data) return <Screen><ErrorView error={rec.error} onRetry={() => rec.refetch()} /></Screen>;
  const r = rec.data;

  return (
    <Screen>
      {r.summary ? (
        <Card tone="primary" style={{ gap: spacing.sm }}>
          <AppText variant="label">{t(`season.${r.season}`)} {r.year}</AppText>
          <AppText>{r.summary}</AppText>
          <SpeakButton id={`summary-${r.id}`} text={r.summary} />
        </Card>
      ) : null}
      {r.results.map((crop, index) => (
        <CropCard key={crop.slug} crop={crop} rank={index + 1} rec={r} />
      ))}
      <AppText variant="small" style={{ textAlign: 'center' }}>{t('reco.disclaimer')}</AppText>
    </Screen>
  );
}

function CropCard({ crop, rank, rec }: { crop: RecommendedCrop; rank: number; rec: Recommendation }) {
  const { t } = useTranslation();
  const createPlan = useCreatePlan();
  const [choosingDate, setChoosingDate] = useState(false);
  const e = crop.economics;

  const spoken = [
    crop.local_name,
    t('reco.score', { score: crop.score }),
    `${t('reco.profit')}: ${formatINR(e.net_profit_inr)}`,
    crop.why,
    `${t('reco.risks')}: ${crop.risks}`,
    `${t('reco.sowing')}: ${crop.sowing_window}`,
    ...crop.key_tips,
  ].join('. ');

  async function start(daysFromNow: number) {
    const date = new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);
    const plan = await createPlan.mutateAsync({ fieldId: rec.field_id, cropSlug: crop.slug, sowingDate: date, recommendationId: rec.id, season: rec.season });
    router.replace(`/plan/${plan.id}`);
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <AppText style={{ fontSize: 40 }}>{crop.emoji}</AppText>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="small">#{rank}</AppText>
          <AppText variant="title">{crop.local_name}</AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={t(`reco.risk_${crop.risk}`)} tone={RISK_TONE[crop.risk]} />
            <Badge label={t(`reco.water_${crop.water_requirement}`)} tone="info" />
            <Badge label={t('reco.duration', { min: crop.duration_days[0], max: crop.duration_days[1] })} tone="info" />
          </Row>
        </View>
      </Row>
      <View style={{ gap: spacing.xs }}>
        <AppText style={{ fontWeight: '700' }}>{t('reco.score', { score: crop.score })}</AppText>
        <ProgressBar value={crop.score} color={RISK_COLOR[crop.risk]} />
      </View>
      <Row style={{ flexWrap: 'wrap', rowGap: spacing.sm }}>
        <Stat label={t('reco.profit')} value={formatINR(e.net_profit_inr)} />
        <Stat label={t('reco.yield')} value={`${e.expected_yield_q} ${t('reco.quintal')}`} />
        <Stat label={`${t('reco.price')} (${t(`reco.priceSource_${e.price_source}`)})`} value={`${formatINR(e.price_inr_q)}/${t('reco.quintal')}`} />
      </Row>
      <Section title={t('reco.why')} body={crop.why} />
      <Section title={t('reco.risks')} body={crop.risks} />
      <Section title={t('reco.sowing')} body={crop.sowing_window} />
      {crop.key_tips.length ? (
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('reco.tips')}</AppText>
          {crop.key_tips.map((tip) => <AppText key={tip}>• {tip}</AppText>)}
        </View>
      ) : null}
      <SpeakButton id={`crop-${rec.id}-${crop.slug}`} text={spoken} />

      {createPlan.isPending ? (
        <Loading message={t('reco.creatingPlan')} />
      ) : choosingDate ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('reco.sowingDate')}</AppText>
          <ChipRow>
            <Chip label={t('reco.sowToday')} onPress={() => start(0)} />
            <Chip label={t('reco.sowWeek')} onPress={() => start(7)} />
            <Chip label={t('reco.sow2Weeks')} onPress={() => start(14)} />
            <Chip label={t('reco.sowMonth')} onPress={() => start(30)} />
          </ChipRow>
        </View>
      ) : (
        <Button title={t('reco.startPlan')} icon="leaf" onPress={() => setChoosingDate(true)} />
      )}
      {createPlan.error ? <ErrorView error={createPlan.error} /> : null}
    </Card>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="label">{title}</AppText>
      <AppText>{body}</AppText>
    </View>
  );
}
