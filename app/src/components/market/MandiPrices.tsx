import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { AppText, Card, Chip, ChipRow, Empty, ErrorView, Loading, Row } from '@/components/ui';
import { useCropName, useCrops, useMarketPrices, useProfile, useStates } from '@/hooks/queries';
import { formatDate, formatINR } from '@/lib/i18n';
import { colors, spacing } from '@/theme';

export function MandiPrices() {
  const { t, i18n } = useTranslation();
  const crops = useCrops();
  const cropName = useCropName();
  const profile = useProfile();
  const { data: states = [] } = useStates();

  const tradable = (crops.data ?? []).filter((c) => c.agmarknet_commodity);
  const [picked, setSlug] = useState<string | null>(null);
  const [allIndia, setAllIndia] = useState(false);

  const slug = picked ?? tradable.find((c) => c.slug === 'wheat')?.slug ?? tradable[0]?.slug ?? null;
  const crop = tradable.find((c) => c.slug === slug);
  const stateName = states.find((s) => s.code === profile.data?.state_code)?.name ?? null;
  const prices = useMarketPrices(crop?.agmarknet_commodity ?? null, allIndia ? null : stateName);

  if (crops.isLoading) return <Loading />;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {tradable.map((c) => (
          <Chip key={c.slug} label={`${c.emoji} ${cropName(c.slug)}`} selected={c.slug === slug} onPress={() => setSlug(c.slug)} />
        ))}
      </ScrollView>
      <ChipRow>
        {stateName ? <Chip label={stateName} icon="location" selected={!allIndia} onPress={() => setAllIndia(false)} /> : null}
        <Chip label={t('market.allIndia')} selected={allIndia || !stateName} onPress={() => setAllIndia(true)} />
      </ChipRow>

      {prices.isLoading ? <Loading /> : null}
      {prices.error ? <ErrorView error={prices.error} onRetry={() => prices.refetch()} /> : null}
      {prices.data && !prices.data.configured ? (
        <Card tone="warning"><AppText variant="small">{t('market.notConfigured')}</AppText></Card>
      ) : null}
      {prices.data?.prices.length === 0 ? <Empty icon="pricetags-outline" title={t('market.empty')} /> : null}

      {prices.data?.prices.map((p) => (
        <Card key={`${p.market}-${p.variety}-${p.arrival_date}`} style={{ gap: spacing.xs }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <AppText variant="subtitle">{p.market}</AppText>
              <AppText variant="small">{[p.district, allIndia ? p.state : null, p.variety].filter(Boolean).join(' · ')}</AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="title" style={{ color: colors.primaryDark }}>{p.modal_price ? formatINR(p.modal_price) : '—'}</AppText>
              <AppText variant="small">{t('market.perQuintal')}</AppText>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="small">
              {p.min_price && p.max_price ? t('market.range', { min: formatINR(p.min_price), max: formatINR(p.max_price) }) : ''}
            </AppText>
            <AppText variant="small">{formatDate(p.arrival_date, i18n.language)}</AppText>
          </Row>
        </Card>
      ))}
    </>
  );
}
