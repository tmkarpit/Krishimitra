import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';
import { PhotoPicker } from '@/components/PhotoPicker';
import { AppText, Button, Card, Chip, ChipRow, ErrorView, Input, Loading, Row, Screen } from '@/components/ui';
import { useCreateListing, useCropName, useCrops, useFields, useProfile, useValuation } from '@/hooks/queries';
import { normalizeIndianPhone } from '@/lib/geo';
import { formatINR } from '@/lib/i18n';
import { uploadPublicPhoto } from '@/lib/upload';
import { colors, spacing } from '@/theme';
import type { CropValuation, Field, Profile } from '@/types/db';

export default function NewListingScreen() {
  const { valuation } = useLocalSearchParams<{ valuation?: string }>();
  const v = useValuation(valuation);
  const profile = useProfile();
  const fields = useFields();
  if ((valuation && v.isLoading) || profile.isLoading || fields.isLoading) return <Loading />;
  return <ListingForm valuation={v.data ?? null} profile={profile.data ?? null} fields={fields.data ?? []} />;
}

function ListingForm({ valuation, profile, fields }: { valuation: CropValuation | null; profile: Profile | null; fields: Field[] }) {
  const { t } = useTranslation();
  const { data: crops = [] } = useCrops();
  const cropName = useCropName();
  const create = useCreateListing();

  const field = fields.find((f) => f.id === valuation?.field_id) ?? fields[0] ?? null;
  const [cropSlug, setCropSlug] = useState<string | null>(valuation?.crop_slug ?? null);
  const [displayName, setDisplayName] = useState(valuation?.result.crop_name_local ?? '');
  const [variety, setVariety] = useState('');
  const [quantity, setQuantity] = useState(valuation?.expected_yield_q ? String(Math.round(valuation.expected_yield_q)) : '');
  const [price, setPrice] = useState(valuation?.price_inr_q ? String(valuation.price_inr_q) : '');
  const [negotiable, setNegotiable] = useState(true);
  const [quality, setQuality] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const tradable = crops.filter((c) => c.agmarknet_commodity);

  async function submit() {
    const qty = parseFloat(quantity.replace(',', '.'));
    const rate = parseFloat(price.replace(',', '.'));
    const contact = normalizeIndianPhone(phone);
    if (!cropSlug) return setError(t('produce.needCrop'));
    if (!(qty > 0) || !(rate > 0)) return setError(t('produce.needQtyPrice'));
    if (!name.trim()) return setError(t('produce.needName'));
    if (!contact) return setError(t('login.invalidPhone'));
    setError(null);
    setUploading(true);
    try {
      const photoUrls = await Promise.all(photos.map(uploadPublicPhoto));
      const listing = await create.mutateAsync({
        field_id: field?.id ?? null,
        valuation_id: valuation?.id ?? null,
        crop_slug: cropSlug,
        crop_name: displayName.trim() || cropName(cropSlug),
        variety: variety.trim() || null,
        quantity_q: qty,
        price_inr_q: rate,
        negotiable,
        quality_note: quality.trim() || null,
        available_from: new Date().toISOString().slice(0, 10),
        description: description.trim() || null,
        photo_urls: photoUrls,
        state_code: field?.state_code ?? profile?.state_code ?? null,
        district: field?.district ?? profile?.district ?? null,
        village: field?.village ?? profile?.village ?? null,
        lat: field?.lat ?? null,
        lng: field?.lng ?? null,
        contact_name: name.trim(),
        contact_phone: contact,
        whatsapp,
      });
      router.replace(`/listing/${listing.id}`);
    } catch {
      // shown via create.error
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      {valuation?.value_low_inr != null ? (
        <Card tone="primary">
          <AppText variant="small">
            {t('produce.fromValuation', { low: formatINR(valuation.value_low_inr), high: formatINR(valuation.value_high_inr ?? 0) })}
          </AppText>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('produce.crop')}</AppText>
        <ChipRow>
          {tradable.map((c) => (
            <Chip key={c.slug} label={`${c.emoji} ${cropName(c.slug)}`} selected={cropSlug === c.slug} onPress={() => setCropSlug(c.slug)} />
          ))}
        </ChipRow>
        <Input label={t('produce.displayName')} placeholder={cropSlug ? cropName(cropSlug) : ''} value={displayName} onChangeText={setDisplayName} />
        <Input label={t('produce.variety')} value={variety} onChangeText={setVariety} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Input label={`${t('produce.quantity')} (${t('reco.quintal')})`} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
        <Input label={`${t('produce.price')} (₹/${t('reco.quintal')})`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText>{t('produce.negotiable')}</AppText>
          <Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ true: colors.primary }} />
        </Row>
        <Input label={t('produce.quality')} placeholder={t('produce.qualityHint')} value={quality} onChangeText={setQuality} />
        <Input label={t('produce.description')} value={description} onChangeText={setDescription} multiline />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('produce.photos')}</AppText>
        <PhotoPicker uris={photos} onChange={setPhotos} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('produce.contact')}</AppText>
        <Input label={t('onboarding.name')} value={name} onChangeText={setName} />
        <Input label={t('login.phoneLabel')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText>{t('produce.allowWhatsapp')}</AppText>
          <Switch value={whatsapp} onValueChange={setWhatsapp} trackColor={{ true: colors.primary }} />
        </Row>
        <AppText variant="small">{t('produce.phoneVisible')}</AppText>
      </Card>

      {error ? <Card tone="danger"><AppText>{error}</AppText></Card> : null}
      {create.error ? <ErrorView error={create.error} /> : null}
      <Button title={t('produce.publish')} icon="megaphone" loading={uploading || create.isPending} onPress={submit} />
    </Screen>
  );
}
