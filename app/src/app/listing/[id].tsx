import { Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ContactButtons } from '@/components/ContactButtons';
import { AppText, Badge, Button, Card, ErrorView, Input, Loading, Row, Screen, SectionTitle, Stat } from '@/components/ui';
import { useEnquiries, useFields, useListing, useProfile, useSendEnquiry, useSetEnquiryStatus, useUpdateListingStatus } from '@/hooks/queries';
import { distanceM, normalizeIndianPhone } from '@/lib/geo';
import { formatDate, formatINR } from '@/lib/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, spacing } from '@/theme';
import type { ListingEnquiry, ProduceListing } from '@/types/db';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const listing = useListing(id);
  const { data: fields } = useFields();

  if (listing.isLoading) return <Loading />;
  if (!listing.data) return <Screen><ErrorView error={listing.error} onRetry={() => listing.refetch()} /></Screen>;
  const l = listing.data;
  const mine = l.user_id === session?.user.id;
  const home = fields?.[0];
  const km = home && l.lat != null && l.lng != null
    ? Math.round(distanceM({ latitude: home.lat, longitude: home.lng }, { latitude: l.lat, longitude: l.lng }) / 1000)
    : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: l.crop_name }} />
      {l.photo_urls.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {l.photo_urls.map((u) => <Image key={u} source={{ uri: u }} style={styles.photo} />)}
        </ScrollView>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{l.crop_name}</AppText>
            {l.variety ? <AppText variant="muted">{l.variety}</AppText> : null}
          </View>
          {l.status !== 'active' ? <Badge label={t(`produce.status_${l.status}`)} tone="warning" /> : null}
        </Row>
        <Row style={{ flexWrap: 'wrap', rowGap: spacing.sm }}>
          <Stat label={t('produce.quantity')} value={`${l.quantity_q} ${t('reco.quintal')}`} />
          <Stat label={t('produce.price')} value={`${formatINR(l.price_inr_q)}/${t('reco.quintal')}`} />
        </Row>
        {l.negotiable ? <Badge label={t('produce.negotiable')} tone="info" /> : null}
        {l.quality_note ? <AppText>{l.quality_note}</AppText> : null}
        {l.description ? <AppText variant="muted">{l.description}</AppText> : null}
        <AppText variant="small">
          {[l.village, l.district].filter(Boolean).join(', ')}
          {km != null ? ` · ${t('produce.kmAway', { km })}` : ''}
          {` · ${formatDate(l.created_at, i18n.language)}`}
        </AppText>
      </Card>

      {mine ? <OwnerPanel listing={l} /> : <BuyerPanel listing={l} />}
    </Screen>
  );
}

function BuyerPanel({ listing: l }: { listing: ProduceListing }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const enquiries = useEnquiries(l.id);
  const send = useSendEnquiry();
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [phone, setPhone] = useState(profile.data?.phone ?? '');
  const [offer, setOffer] = useState('');
  const [qty, setQty] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const greeting = t('produce.waMessage', { crop: l.crop_name, qty: l.quantity_q });

  async function submit() {
    const contact = normalizeIndianPhone(phone);
    if (!name.trim()) return setError(t('produce.needName'));
    if (!contact) return setError(t('login.invalidPhone'));
    setError(null);
    const num = (s: string) => {
      const n = parseFloat(s.replace(',', '.'));
      return n > 0 ? n : null;
    };
    await send.mutateAsync({
      listing_id: l.id,
      buyer_name: name.trim(),
      buyer_phone: contact,
      offered_price_inr_q: num(offer),
      quantity_q: num(qty),
      message: message.trim() || null,
    });
    setOffer('');
    setQty('');
    setMessage('');
  }

  return (
    <>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="subtitle">{t('produce.contactFarmer', { name: l.contact_name })}</AppText>
        <ContactButtons phone={l.contact_phone} whatsapp={l.whatsapp} message={greeting} />
      </Card>

      {l.status === 'active' ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="subtitle">{t('produce.makeOffer')}</AppText>
          <Input label={t('onboarding.name')} value={name} onChangeText={setName} />
          <Input label={t('login.phoneLabel')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label={`${t('produce.offerPrice')} (₹/${t('reco.quintal')})`} keyboardType="decimal-pad" value={offer} onChangeText={setOffer} />
          <Input label={`${t('produce.quantity')} (${t('reco.quintal')})`} keyboardType="decimal-pad" value={qty} onChangeText={setQty} />
          <Input label={t('produce.message')} value={message} onChangeText={setMessage} multiline />
          {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
          {send.error ? <ErrorView error={send.error} /> : null}
          {send.isSuccess ? <AppText>{t('produce.offerSent')}</AppText> : null}
          <Button title={t('produce.sendOffer')} icon="send" loading={send.isPending} onPress={submit} />
        </Card>
      ) : null}

      {enquiries.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t('produce.myOffers')}</SectionTitle>
          {enquiries.data.map((e) => <EnquiryCard key={e.id} e={e} />)}
        </View>
      ) : null}
    </>
  );
}

function OwnerPanel({ listing: l }: { listing: ProduceListing }) {
  const { t } = useTranslation();
  const enquiries = useEnquiries(l.id);
  const setStatus = useUpdateListingStatus();
  const setEnquiry = useSetEnquiryStatus();

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <SectionTitle>{t('produce.offers')}</SectionTitle>
        {enquiries.isLoading ? <Loading /> : null}
        {enquiries.data?.length === 0 ? <Card><AppText variant="muted">{t('produce.noOffers')}</AppText></Card> : null}
        {enquiries.data?.map((e) => (
          <EnquiryCard key={e.id} e={e}>
            <ContactButtons phone={e.buyer_phone} message={t('produce.waReply', { crop: l.crop_name })} />
            {e.status === 'new' || e.status === 'seen' ? (
              <Row>
                <Button title={t('produce.accept')} icon="checkmark" variant="secondary" style={{ flex: 1 }}
                  onPress={() => setEnquiry.mutate({ id: e.id, listingId: l.id, status: 'accepted' })} />
                <Button title={t('produce.decline')} icon="close" variant="danger" style={{ flex: 1 }}
                  onPress={() => setEnquiry.mutate({ id: e.id, listingId: l.id, status: 'declined' })} />
              </Row>
            ) : null}
          </EnquiryCard>
        ))}
      </View>
      {l.status === 'active' ? (
        <Row>
          <Button title={t('produce.markSold')} icon="checkmark-done" style={{ flex: 1 }} loading={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: l.id, status: 'sold' })} />
          <Button title={t('produce.close')} icon="eye-off" variant="danger" style={{ flex: 1 }}
            onPress={() => setStatus.mutate({ id: l.id, status: 'closed' })} />
        </Row>
      ) : (
        <Button title={t('produce.reopen')} icon="refresh" variant="secondary" onPress={() => setStatus.mutate({ id: l.id, status: 'active' })} />
      )}
    </>
  );
}

function EnquiryCard({ e, children }: { e: ListingEnquiry; children?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const tone = e.status === 'accepted' ? 'primary' : e.status === 'declined' ? 'danger' : 'info';
  return (
    <Card style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText style={{ fontWeight: '700', flex: 1 }}>{e.buyer_name}</AppText>
        <Badge label={t(`produce.offer_${e.status}`)} tone={tone} />
      </Row>
      <AppText variant="small">
        {[
          e.offered_price_inr_q ? `${formatINR(e.offered_price_inr_q)}/${t('reco.quintal')}` : null,
          e.quantity_q ? `${e.quantity_q} ${t('reco.quintal')}` : null,
          formatDate(e.created_at, i18n.language),
        ].filter(Boolean).join(' · ')}
      </AppText>
      {e.message ? <AppText>{e.message}</AppText> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: 260, height: 190, borderRadius: radius.lg },
});
