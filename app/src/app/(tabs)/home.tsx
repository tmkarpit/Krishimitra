import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AlertItem } from '@/components/AlertItem';
import { TaskItem } from '@/components/TaskItem';
import { WeatherNow } from '@/components/Weather';
import { AppText, Button, Card, Empty, ErrorView, type IconName, Loading, SectionTitle } from '@/components/ui';
import { useAlerts, useCropName, useFieldAnalysis, useFields, usePlans, useProfile, useUpcomingTasks } from '@/hooks/queries';
import { formatDate } from '@/lib/i18n';
import { colors, font, radius, spacing } from '@/theme';

export default function Home() {
  const { t, i18n } = useTranslation();
  const profile = useProfile();
  const fields = useFields();
  const firstField = fields.data?.[0];
  const analysis = useFieldAnalysis(firstField?.id);
  const tasks = useUpcomingTasks();
  const alerts = useAlerts();
  const plans = usePlans();
  const cropName = useCropName();

  const refreshing = fields.isRefetching || tasks.isRefetching || alerts.isRefetching;
  const refresh = () => {
    void fields.refetch();
    void tasks.refetch();
    void alerts.refetch();
    void plans.refetch();
    void analysis.refetch();
  };

  const quick: { icon: IconName; label: string; href: Href }[] = [
    { icon: 'leaf', label: t('home.quick.recommend'), href: firstField ? `/field/${firstField.id}` : '/field/new' },
    { icon: 'cash', label: t('home.quick.value'), href: '/value' },
    { icon: 'bug', label: t('home.quick.diagnose'), href: '/diagnose' },
    { icon: 'storefront', label: t('home.quick.sell'), href: '/market?tab=produce' },
    { icon: 'cart', label: t('home.quick.seeds'), href: '/market?tab=seeds' },
    { icon: 'pricetags', label: t('home.quick.mandi'), href: '/market?tab=prices' },
    { icon: 'document-text', label: t('home.quick.schemes'), href: '/schemes' },
  ];

  const name = profile.data?.full_name?.split(' ')[0];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
    >
      <AppText variant="title">{name ? t('home.greeting', { name }) : t('home.greetingNoName')}</AppText>

      <View style={styles.quickGrid}>
        {quick.map((q) => (
          <Pressable key={q.label} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]} onPress={() => router.push(q.href)}>
            <Ionicons name={q.icon} size={30} color={colors.primary} />
            <AppText style={styles.quickLabel}>{q.label}</AppText>
          </Pressable>
        ))}
      </View>

      {alerts.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle right={<Button title={t('common.seeAll')} variant="ghost" onPress={() => router.push('/alerts')} />}>
            {t('alerts.title')}
          </SectionTitle>
          {alerts.data.slice(0, 2).map((a) => <AlertItem key={a.id} alert={a} />)}
        </View>
      ) : null}

      {fields.isLoading ? (
        <Loading />
      ) : fields.error ? (
        <ErrorView error={fields.error} onRetry={() => fields.refetch()} />
      ) : !firstField ? (
        <Empty
          icon="map-outline"
          title={t('home.noFieldTitle')}
          body={t('home.noFieldBody')}
          action={<Button title={t('home.addField')} icon="add-circle" onPress={() => router.push('/field/new')} />}
        />
      ) : analysis.data ? (
        <WeatherNow weather={analysis.data.weather} title={t('home.weatherFor', { field: firstField.name })} />
      ) : analysis.isLoading ? (
        <Card><Loading message={t('field.analysing')} /></Card>
      ) : null}

      {plans.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t('home.myCrops')}</SectionTitle>
          {plans.data.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/plan/${p.id}`)} style={styles.planRow}>
              <AppText style={{ fontSize: 30 }}>{p.crops?.emoji ?? '🌱'}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="subtitle">{p.guidance?.crop_local_name || cropName(p.crops?.slug)}</AppText>
                <AppText variant="small">{t('plan.sown', { date: formatDate(p.sowing_date, i18n.language) })}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Card>
          ))}
        </View>
      ) : null}

      {firstField ? (
        <View style={{ gap: spacing.xs }}>
          <SectionTitle>{t('home.todayTasks')}</SectionTitle>
          <Card>
            {tasks.data?.length ? (
              tasks.data.map((task) => <TaskItem key={task.id} task={task} prefix={task.crop_plans?.crops?.emoji} />)
            ) : (
              <AppText variant="muted">{t('home.noTasks')}</AppText>
            )}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: {
    width: '48.5%',
    minHeight: 92,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  quickLabel: { fontWeight: '700', fontSize: font.body - 1, textAlign: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
