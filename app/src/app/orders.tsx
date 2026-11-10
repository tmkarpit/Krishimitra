import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { ContactButtons } from '@/components/ContactButtons';
import { AppText, Badge, Button, Card, Chip, ChipRow, Empty, ErrorView, Loading, Row, Screen } from '@/components/ui';
import { useOrders, useProfile, useSetOrderStatus } from '@/hooks/queries';
import { formatDate, formatINR } from '@/lib/i18n';
import { spacing } from '@/theme';
import type { InputOrder, OrderStatus } from '@/types/db';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { placed: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

export default function OrdersScreen() {
  const { t } = useTranslation();
  const isSeller = useProfile().data?.account_type === 'seller';
  const [kind, setKind] = useState<'placed' | 'received'>('placed');
  const orders = useOrders(kind);

  return (
    <Screen>
      {isSeller ? (
        <ChipRow>
          <Chip label={t('orders.mine')} selected={kind === 'placed'} onPress={() => setKind('placed')} />
          <Chip label={t('orders.received')} selected={kind === 'received'} onPress={() => setKind('received')} />
        </ChipRow>
      ) : null}
      {orders.isLoading ? <Loading /> : null}
      {orders.error ? <ErrorView error={orders.error} onRetry={() => orders.refetch()} /> : null}
      {orders.data?.length === 0 ? <Empty icon="cart-outline" title={t('orders.empty')} /> : null}
      {orders.data?.map((o) => <OrderCard key={o.id} o={o} asSeller={kind === 'received'} />)}
    </Screen>
  );
}

function OrderCard({ o, asSeller }: { o: InputOrder; asSeller: boolean }) {
  const { t, i18n } = useTranslation();
  const setStatus = useSetOrderStatus();
  const tone = o.status === 'delivered' ? 'primary' : o.status === 'cancelled' ? 'danger' : 'info';
  const next = NEXT[o.status];

  function cancel() {
    Alert.alert(t('orders.cancel'), t('orders.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('orders.cancel'), style: 'destructive', onPress: () => setStatus.mutate({ id: o.id, status: 'cancelled' }) },
    ]);
  }

  return (
    <Card style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <AppText style={{ fontWeight: '700', flex: 1 }}>{o.product_name}</AppText>
        <Badge label={t(`orders.status_${o.status}`)} tone={tone} />
      </Row>
      <AppText>{o.quantity} × {formatINR(o.unit_price_inr)} = <AppText style={{ fontWeight: '700' }}>{formatINR(o.total_inr)}</AppText></AppText>
      <AppText variant="small">{t('shop.cod')} · {formatDate(o.created_at, i18n.language)}</AppText>
      {asSeller ? (
        <>
          <AppText variant="small">{o.delivery_name} · {o.delivery_address}</AppText>
          <ContactButtons phone={o.delivery_phone} />
        </>
      ) : null}
      <Row>
        {asSeller && next ? (
          <Button title={t(`orders.to_${next}`)} icon="arrow-forward" style={{ flex: 1 }} loading={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: o.id, status: next })} />
        ) : null}
        {o.status === 'placed' || (asSeller && o.status === 'confirmed') ? (
          <Button title={t('orders.cancel')} icon="close" variant="danger" style={{ flex: 1 }} onPress={cancel} />
        ) : null}
      </Row>
      {setStatus.error ? <ErrorView error={setStatus.error} /> : null}
    </Card>
  );
}
