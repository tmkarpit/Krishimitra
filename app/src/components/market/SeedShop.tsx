import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Badge, Button, Card, Chip, ChipRow, Empty, ErrorView, Loading, Row } from '@/components/ui';
import { useCropName, useCrops, useProducts, useProfile } from '@/hooks/queries';
import { formatINR } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme';
import type { ProductCategory } from '@/types/db';

const CATEGORIES: (ProductCategory | 'all')[] = ['all', 'seed', 'biofertilizer', 'fertilizer', 'pesticide', 'tool'];

export function SeedShop() {
  const { t } = useTranslation();
  const { data: crops = [] } = useCrops();
  const cropName = useCropName();
  const isSeller = useProfile().data?.account_type === 'seller';
  const [category, setCategory] = useState<ProductCategory | 'all'>('seed');
  const [cropSlug, setCropSlug] = useState<string | null>(null);
  const products = useProducts({ category, cropSlug });

  return (
    <>
      <Row>
        <Button title={t('orders.title')} icon="receipt" variant="secondary" onPress={() => router.push('/orders')} style={{ flex: 1 }} />
        {isSeller ? <Button title={t('shop.addProduct')} icon="add-circle" onPress={() => router.push('/shop/new')} style={{ flex: 1 }} /> : null}
      </Row>
      <ChipRow>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c === 'all' ? t('produce.allCrops') : t(`shop.cat_${c}`)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={t('produce.allCrops')} selected={cropSlug === null} onPress={() => setCropSlug(null)} />
        {crops.map((c) => (
          <Chip key={c.slug} label={`${c.emoji} ${cropName(c.slug)}`} selected={cropSlug === c.slug} onPress={() => setCropSlug(c.slug)} />
        ))}
      </ScrollView>

      {products.isLoading ? <Loading /> : null}
      {products.error ? <ErrorView error={products.error} onRetry={() => products.refetch()} /> : null}
      {products.data?.length === 0 ? <Empty icon="leaf-outline" title={t('shop.empty')} /> : null}

      {products.data?.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/shop/${p.id}`)} style={styles.row}>
          {p.image_url ? (
            <Image source={{ uri: p.image_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.noPhoto]}>
              <Ionicons name={p.category === 'seed' ? 'leaf' : p.category === 'tool' ? 'construct' : 'flask'} size={30} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: '700' }}>{p.name}</AppText>
            {p.variety ? <AppText variant="small">{p.variety} · {p.pack_size}</AppText> : <AppText variant="small">{p.pack_size}</AppText>}
            <AppText style={{ fontWeight: '700', color: colors.primaryDark }}>{formatINR(p.price_inr)}</AppText>
            <Row style={{ flexWrap: 'wrap' }}>
              {p.certified ? <Badge label={t('shop.certified')} tone="primary" /> : null}
              {p.is_sample ? <Badge label={t('shop.sample')} tone="warning" /> : null}
            </Row>
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  noPhoto: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
