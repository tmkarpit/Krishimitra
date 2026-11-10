import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';
import { PhotoPicker } from '@/components/PhotoPicker';
import { AppText, Button, Card, Chip, ChipRow, ErrorView, Input, Loading, Row, Screen } from '@/components/ui';
import { useCreateProduct, useCropName, useCrops, useProfile } from '@/hooks/queries';
import { normalizeIndianPhone } from '@/lib/geo';
import { uploadPublicPhoto } from '@/lib/upload';
import { colors, spacing } from '@/theme';
import type { ProductCategory, Profile } from '@/types/db';

const CATEGORIES: ProductCategory[] = ['seed', 'fertilizer', 'biofertilizer', 'pesticide', 'tool'];

export default function NewProductScreen() {
  const profile = useProfile();
  if (profile.isLoading) return <Loading />;
  return <ProductForm profile={profile.data ?? null} />;
}

function ProductForm({ profile }: { profile: Profile | null }) {
  const { t } = useTranslation();
  const { data: crops = [] } = useCrops();
  const cropName = useCropName();
  const create = useCreateProduct();

  const [category, setCategory] = useState<ProductCategory>('seed');
  const [cropSlug, setCropSlug] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [pack, setPack] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('10');
  const [certified, setCertified] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [shop, setShop] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isSeller = profile?.account_type === 'seller';

  async function submit() {
    const p = parseFloat(price);
    const s = parseInt(stock, 10);
    const contact = normalizeIndianPhone(phone);
    if (!name.trim() || !pack.trim() || !shop.trim()) return setError(t('shop.needFields'));
    if (!(p > 0) || !(s >= 0)) return setError(t('produce.needQtyPrice'));
    if (!contact) return setError(t('login.invalidPhone'));
    setError(null);
    setUploading(true);
    try {
      const imageUrl = photos[0] ? await uploadPublicPhoto(photos[0]) : null;
      const m = parseFloat(mrp);
      await create.mutateAsync({
        seller_name: shop.trim(),
        seller_phone: contact,
        category,
        crop_slug: cropSlug,
        name: name.trim(),
        variety: variety.trim() || null,
        pack_size: pack.trim(),
        price_inr: p,
        mrp_inr: m > 0 ? m : null,
        stock: s,
        certified,
        description: description.trim() || null,
        image_url: imageUrl,
      });
      router.back();
    } catch {
      // shown via create.error
    } finally {
      setUploading(false);
    }
  }

  if (!isSeller) {
    return (
      <Screen>
        <Card tone="warning" style={{ gap: spacing.sm }}>
          <AppText>{t('shop.becomeSeller')}</AppText>
          <Button title={t('profile.edit')} icon="person" variant="secondary" onPress={() => router.push('/onboarding')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('shop.category')}</AppText>
        <ChipRow>
          {CATEGORIES.map((c) => <Chip key={c} label={t(`shop.cat_${c}`)} selected={category === c} onPress={() => setCategory(c)} />)}
        </ChipRow>
        <AppText variant="label">{t('produce.crop')}</AppText>
        <ChipRow>
          <Chip label={t('field.none')} selected={cropSlug === null} onPress={() => setCropSlug(null)} />
          {crops.map((c) => <Chip key={c.slug} label={cropName(c.slug)} selected={cropSlug === c.slug} onPress={() => setCropSlug(c.slug)} />)}
        </ChipRow>
      </Card>
      <Card style={{ gap: spacing.sm }}>
        <Input label={t('shop.productName')} value={name} onChangeText={setName} />
        <Input label={t('produce.variety')} value={variety} onChangeText={setVariety} />
        <Input label={t('shop.packSize')} placeholder="40 kg bag" value={pack} onChangeText={setPack} />
        <Input label={`${t('produce.price')} (₹)`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <Input label="MRP (₹)" keyboardType="decimal-pad" value={mrp} onChangeText={setMrp} />
        <Input label={t('shop.stock')} keyboardType="number-pad" value={stock} onChangeText={setStock} />
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText>{t('shop.certified')}</AppText>
          <Switch value={certified} onValueChange={setCertified} trackColor={{ true: colors.primary }} />
        </Row>
        <Input label={t('produce.description')} value={description} onChangeText={setDescription} multiline />
        <PhotoPicker uris={photos} onChange={setPhotos} max={1} />
      </Card>
      <Card style={{ gap: spacing.sm }}>
        <Input label={t('shop.shopName')} value={shop} onChangeText={setShop} />
        <Input label={t('login.phoneLabel')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      </Card>
      {error ? <Card tone="danger"><AppText>{error}</AppText></Card> : null}
      {create.error ? <ErrorView error={create.error} /> : null}
      <Button title={t('shop.publishProduct')} icon="add-circle" loading={uploading || create.isPending} onPress={submit} />
    </Screen>
  );
}
