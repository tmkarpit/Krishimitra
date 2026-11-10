import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/i18n';
import { colors, spacing } from '@/theme';
import type { Alert } from '@/types/db';
import { SpeakButton } from './SpeakButton';
import { AppText, Card, type IconName, Row } from './ui';

const ICONS: Record<Alert['type'], IconName> = {
  heavy_rain: 'thunderstorm',
  rain: 'rainy',
  heat: 'sunny',
  cold: 'snow',
  frost: 'snow',
  wind: 'flag',
  task: 'checkbox',
  price: 'pricetag',
};

export function AlertItem({ alert }: { alert: Alert }) {
  const { t, i18n } = useTranslation();
  const text = t(`alerts.${alert.type}`, {
    ...alert.data,
    date: formatDate(String(alert.data.date ?? alert.valid_on), i18n.language),
  });
  const severe = alert.severity === 'severe';
  return (
    <Card tone={severe ? 'danger' : 'warning'} style={{ gap: spacing.sm }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Ionicons name={ICONS[alert.type]} size={26} color={severe ? colors.danger : colors.warning} />
        <AppText style={{ flex: 1 }}>{text}</AppText>
      </Row>
      <SpeakButton id={`alert-${alert.id}`} text={text} />
    </Card>
  );
}
