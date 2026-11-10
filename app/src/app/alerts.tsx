import { useTranslation } from 'react-i18next';
import { AlertItem } from '@/components/AlertItem';
import { Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { useAlerts } from '@/hooks/queries';

export default function AlertsScreen() {
  const { t } = useTranslation();
  const alerts = useAlerts();
  if (alerts.isLoading) return <Loading />;
  return (
    <Screen>
      {alerts.error ? <ErrorView error={alerts.error} onRetry={() => alerts.refetch()} /> : null}
      {alerts.data?.length === 0 ? <Empty icon="sunny-outline" title={t('alerts.empty')} /> : null}
      {alerts.data?.map((a) => <AlertItem key={a.id} alert={a} />)}
    </Screen>
  );
}
