import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { ContactButtons } from '@/components/ContactButtons';
import { AppText, Badge, Button, Card, ErrorView, IconButton, Input, Loading, Row, Screen } from '@/components/ui';
import { useCropName, useCrops, useProduct, useProfile, usePlaceOrder } from '@/hooks/queries';
import { normalizeIndianPhone } from '@/lib/geo';
import { formatINR } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme';
import type { InputProduct, Profile } from '@/types/db';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const profile = useProfile();
  if (product.isLoading || profile.isLoading) return <Loading />;
  if (!product.data) return <Screen><ErrorView error={product.error} onRetry={() => product.refetch()} /></Screen>;
  return <ProductView p={product.data} profile={profile.data ?? null} />;
}

function ProductView({ p, profile }: { p: InputProduct; profile: Profile | null }) {
  const { t } = useTranslation();
  useCrops();
  const cropName = useCropName();
  const order = usePlaceOrder();
  const [qty, setQty] = useState(1);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState([profile?.village, profile?.district].filter(Boolean).join(', '));
  const [error, setError] = useState<string | null>(null);

  async function place() {
    const contact = normalizeIndianPhone(phone);
    if (!name.trim()) return setError(t('produce.needName'));
    if (!contact) return setError(t('login.invalidPhone'));
    if (address.trim().length < 5) return setError(t('shop.needAddress'));
    setError(null);
    await order.mutateAsync({ product_id: p.id, quantity: qty, delivery_name: name.trim(), delivery_phone: contact, delivery_address: address.trim() });
    router.replace('/orders');
  }

  const discount = p.mrp_inr && p.mrp_inr > p.price_inr ? Math.round((1 - p.price_inr / p.mrp_inr) * 100) : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.photo} /> : null}
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="title">{p.name}</AppText>
        {p.variety ? <AppText variant="subtitle">{p.variety}</AppText> : null}
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge label={t(`shop.cat_${p.category}`)} tone="info" />
          {p.crop_slug ? <Badge label={cropName(p.crop_slug)} tone="primary" /> : null}
          {p.certified ? <Badge label={t('shop.certified')} tone="primary" /> : null}
          {p.is_sample ? <Badge label={t('shop.sample')} tone="warning" /> : null}
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <AppText variant="hero" style={{ color: colors.primaryDark }}>{formatINR(p.price_inr)}</AppText>
          <AppText variant="muted">/ {p.pack_size}</AppText>
        </Row>
        {discount > 0 ? <AppText variant="small">{t('shop.mrp', { mrp: formatINR(p.mrp_inr ?? 0), off: discount })}</AppText> : null}
        {p.description ? <AppText>{p.description}</AppText> : null}
        <AppText variant="small">{t('shop.soldBy', { seller: p.seller_name })} · {t('shop.inStock', { count: p.stock })}</AppText>
        {p.is_sample ? <AppText variant="small">{t('shop.sampleNote')}</AppText> : null}
      </Card>

      {p.seller_phone ? <ContactButtons phone={p.seller_phone} message={t('shop.waEnquiry', { product: p.name })} /> : null}

      {p.stock > 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="subtitle">{t('shop.orderNow')}</AppText>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText>{t('shop.quantity')}</AppText>
            <Row>
              <IconButton icon="remove-circle" label="-" onPress={() => setQty((q) => Math.max(1, q - 1))} />
              <AppText variant="subtitle" style={{ minWidth: 32, textAlign: 'center' }}>{qty}</AppText>
              <IconButton icon="add-circle" label="+" onPress={() => setQty((q) => Math.min(p.stock, q + 1))} />
            </Row>
          </Row>
          <Input label={t('onboarding.name')} value={name} onChangeText={setName} />
          <Input label={t('login.phoneLabel')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label={t('shop.address')} value={address} onChangeText={setAddress} multiline />
          <View style={styles.total}>
            <AppText variant="label">{t('shop.total')}</AppText>
            <AppText variant="title">{formatINR(p.price_inr * qty)}</AppText>
            <AppText variant="small">{t('shop.cod')}</AppText>
          </View>
          {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
          {order.error ? <ErrorView error={order.error} /> : null}
          <Button title={t('shop.placeOrder')} icon="cart" loading={order.isPending} onPress={place} />
        </Card>
      ) : (
        <Card tone="warning"><AppText>{t('shop.outOfStock')}</AppText></Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  total: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
