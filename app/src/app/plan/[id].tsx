import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SpeakButton } from '@/components/SpeakButton';
import { TaskItem } from '@/components/TaskItem';
import { AppText, Button, Card, ErrorView, Loading, Row, Screen, SectionTitle } from '@/components/ui';
import { useCropName, usePlan, usePlanTasks, useUpdatePlanStatus } from '@/hooks/queries';
import { formatDate, formatINR } from '@/lib/i18n';
import { colors, spacing } from '@/theme';
import type { FertilizerPlan } from '@/types/db';

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const plan = usePlan(id);
  const tasks = usePlanTasks(id);
  const updateStatus = useUpdatePlanStatus();
  const cropName = useCropName();

  if (plan.isLoading) return <Loading />;
  if (!plan.data) return <Screen><ErrorView error={plan.error} onRetry={() => plan.refetch()} /></Screen>;
  const p = plan.data;
  const g = p.guidance;
  const name = g.crop_local_name || cropName(p.crops?.slug);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${p.crops?.emoji ?? ''} ${name}` }} />
      <Card tone="primary" style={{ gap: spacing.sm }}>
        <AppText variant="title">{name}</AppText>
        <AppText>{t('plan.sown', { date: formatDate(p.sowing_date, i18n.language) })}</AppText>
        {p.expected_harvest_date ? <AppText>{t('plan.harvest', { date: formatDate(p.expected_harvest_date, i18n.language) })}</AppText> : null}
        <AppText>{g.overview}</AppText>
        <SpeakButton id={`plan-${p.id}-overview`} text={`${name}. ${g.overview}`} />
      </Card>

      <View style={{ gap: spacing.xs }}>
        <SectionTitle>{t('plan.tasks')}</SectionTitle>
        <Card>
          {tasks.isLoading ? <Loading /> : tasks.data?.map((task) => <TaskItem key={task.id} task={task} />)}
        </Card>
      </View>

      <FertilizerCard plan={p.fertilizer_plan} tips={g.fertilizer_tips} id={p.id} />

      <GuideCard id={`${p.id}-prep`} title={t('plan.landPrep')} body={g.land_preparation} />
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="subtitle">{t('plan.seed')}</AppText>
        <Item label={t('plan.varieties')} value={g.seed.varieties.join(', ')} />
        <Item label={t('plan.seedRate')} value={g.seed.seed_rate} />
        <Item label={t('plan.spacing')} value={g.seed.spacing} />
        <Item label={t('plan.seedTreatment')} value={g.seed.seed_treatment} />
        <SpeakButton id={`${p.id}-seed`} text={[g.seed.varieties.join(', '), g.seed.seed_rate, g.seed.spacing, g.seed.seed_treatment].join('. ')} />
      </Card>
      <GuideCard id={`${p.id}-irrigation`} title={t('plan.irrigation')} body={g.irrigation} />

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="subtitle">{t('plan.pests')}</AppText>
        {g.pest_watch.map((pest) => (
          <View key={pest.name} style={{ gap: 2, paddingVertical: spacing.xs }}>
            <AppText style={{ fontWeight: '700' }}>{pest.name}</AppText>
            <AppText variant="small">{pest.signs}</AppText>
            <AppText>→ {pest.action}</AppText>
          </View>
        ))}
        <SpeakButton id={`${p.id}-pests`} text={g.pest_watch.map((x) => `${x.name}. ${x.signs}. ${x.action}`).join('. ')} />
      </Card>

      {g.organic_options.length ? (
        <GuideCard id={`${p.id}-organic`} title={t('plan.organic')} body={g.organic_options.map((o) => `• ${o}`).join('\n')} />
      ) : null}
      <GuideCard id={`${p.id}-harvest`} title={t('plan.harvestTitle')} body={g.harvest} />

      {p.status === 'active' ? (
        <Button
          title={t('plan.endPlan')}
          icon="checkmark-done"
          variant="secondary"
          loading={updateStatus.isPending}
          onPress={() => updateStatus.mutate({ id: p.id, status: 'harvested' })}
        />
      ) : null}
    </Screen>
  );
}

function FertilizerCard({ plan, tips, id }: { plan: FertilizerPlan; tips: string; id: string }) {
  const { t } = useTranslation();
  const productName = (slug: string) => plan.products.find((p) => p.slug === slug)?.name ?? slug.toUpperCase();
  const s = plan.soil_status;
  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="subtitle">{t('plan.fertilizer')}</AppText>
      <AppText variant="small">
        {t('plan.soilStatus', { n: t(`plan.status_${s.n}`), p: t(`plan.status_${s.p}`), k: t(`plan.status_${s.k}`) })}
      </AppText>
      {plan.products.map((p) => (
        <Row key={p.slug} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '700' }}>{p.name}</AppText>
            <AppText variant="small">{p.kg_per_ha} kg/ha</AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText style={{ fontWeight: '700' }}>{p.kg_total} kg</AppText>
            <AppText variant="small">{t('plan.bags', { bags: p.bags_50kg })} · {formatINR(p.cost_inr)}</AppText>
          </View>
        </Row>
      ))}
      <AppText style={{ fontWeight: '700', color: colors.primaryDark }}>{t('plan.fertilizerTotal', { cost: formatINR(plan.total_cost_inr) })}</AppText>
      <View style={{ gap: spacing.xs }}>
        {plan.schedule.map((step) => (
          <View key={step.stage}>
            <AppText variant="label">{t(`plan.${step.stage}`, { day: step.day_offset })}</AppText>
            <AppText>{step.items.map((i) => `${productName(i.slug)} ${i.kg_total} kg`).join(' + ')}</AppText>
          </View>
        ))}
      </View>
      {tips ? <AppText variant="muted">{tips}</AppText> : null}
      <SpeakButton
        id={`${id}-fert`}
        text={[
          ...plan.schedule.map((step) => `${t(`plan.${step.stage}`, { day: step.day_offset })}: ${step.items.map((i) => `${productName(i.slug)} ${i.kg_total} kg`).join(', ')}`),
          tips,
        ].join('. ')}
      />
    </Card>
  );
}

function GuideCard({ id, title, body }: { id: string; title: string; body: string }) {
  if (!body) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="subtitle">{title}</AppText>
      <AppText>{body}</AppText>
      <SpeakButton id={id} text={`${title}. ${body}`} />
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View>
      <AppText variant="label">{label}</AppText>
      <AppText>{value}</AppText>
    </View>
  );
}
