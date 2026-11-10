import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Badge, Button, Card, Chip, ChipRow, Empty, ErrorView, Loading, Row } from '@/components/ui';
import { useCropName, useCrops, useFields, useListings } from '@/hooks/queries';
import { distanceM } from '@/lib/geo';
import { formatINR } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme';
import type { ProduceListing } from '@/types/db';

export function ProduceMarket() {
  const { t } = useTranslation();
  const { data: crops = [] } = useCrops();
  const cropName = useCropName();
  const { data: fields } = useFields();
  const [cropSlug, setCropSlug] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const listings = useListings({ cropSlug, mine });

  const home = fields?.[0];
  const km = (l: ProduceListing) =>
    home && l.lat != null && l.lng != null
      ? Math.round(distanceM({ latitude: home.lat, longitude: home.lng }, { latitude: l.lat, longitude: l.lng }) / 1000)
      : null;
  // Nearest first when we know where the user farms.
  const rows = [...(listings.data ?? [])].sort((a, b) => (km(a) ?? 1e9) - (km(b) ?? 1e9));

  return (
    <>
      <Row>
        <Button title={t('produce.sellCrop')} icon="add-circle" onPress={() => router.push('/listing/new')} style={{ flex: 1 }} />
        <Button title={t('home.quick.value')} icon="cash" variant="secondary" onPress={() => router.push('/value')} style={{ flex: 1 }} />
      </Row>
      <ChipRow>
        <Chip label={t('produce.allListings')} selected={!mine} onPress={() => setMine(false)} />
        <Chip label={t('produce.myListings')} icon="person" selected={mine} onPress={() => setMine(true)} />
      </ChipRow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={t('produce.allCrops')} selected={cropSlug === null} onPress={() => setCropSlug(null)} />
        {crops.filter((c) => c.agmarknet_commodity).map((c) => (
          <Chip key={c.slug} label={`${c.emoji} ${cropName(c.slug)}`} selected={cropSlug === c.slug} onPress={() => setCropSlug(c.slug)} />
        ))}
      </ScrollView>

      {listings.isLoading ? <Loading /> : null}
      {listings.error ? <ErrorView error={listings.error} onRetry={() => listings.refetch()} /> : null}
      {listings.data?.length === 0 ? <Empty icon="storefront-outline" title={t('produce.empty')} body={t('produce.emptyBody')} /> : null}

      {rows.map((l) => {
        const d = km(l);
        return (
          <Card key={l.id} onPress={() => router.push(`/listing/${l.id}`)} style={styles.row}>
            {l.photo_urls[0] ? (
              <Image source={{ uri: l.photo_urls[0] }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.noPhoto]}><Ionicons name="leaf" size={32} color={colors.primary} /></View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="subtitle">{l.crop_name}</AppText>
              <AppText style={{ fontWeight: '700', color: colors.primaryDark }}>
                {formatINR(l.price_inr_q)}/{t('reco.quintal')} · {l.quantity_q} {t('reco.quintal')}
              </AppText>
              <AppText variant="small">
                {[l.village, l.district].filter(Boolean).join(', ')}
                {d != null ? ` · ${t('produce.kmAway', { km: d })}` : ''}
              </AppText>
              {l.status !== 'active' ? <Badge label={t(`produce.status_${l.status}`)} tone="warning" /> : null}
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  noPhoto: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
