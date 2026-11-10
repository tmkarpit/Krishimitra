import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { colors } from '@/theme';
import { Button, Row } from './ui';

/** Call / WhatsApp buttons. `phone` is E.164 (+91…). */
export function ContactButtons({ phone, whatsapp = true, message }: { phone: string; whatsapp?: boolean; message?: string }) {
  const { t } = useTranslation();
  const digits = phone.replace(/\D/g, '');
  return (
    <Row>
      <Button title={t('produce.call')} icon="call" onPress={() => Linking.openURL(`tel:${phone}`)} style={{ flex: 1 }} />
      {whatsapp ? (
        <Button
          title="WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          style={{ flex: 1, borderColor: colors.primaryDark }}
          onPress={() => Linking.openURL(`https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`)}
        />
      ) : null}
    </Row>
  );
}
