import { AlertCenterCard } from '@/components/AlertCenterCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useTranslation } from '@/i18n';
import { useAlertCenter } from '@/store/useAlertCenter';

export default function AlertsScreen() {
  const t = useTranslation();
  const alertCenter = useAlertCenter();

  return (
    <ScreenScaffold
      backLabel={t('common.back')}
      showBack
      title={t('alerts.title')}
      subtitle={t('alerts.subtitle')}
    >
      <AlertCenterCard
        alerts={alertCenter.alerts}
        preferences={alertCenter.preferences}
        unreadCount={alertCenter.unreadCount}
        onMarkAsRead={alertCenter.markAsRead}
        onMarkAllAsRead={alertCenter.markAllAsRead}
        onDeleteAlert={alertCenter.deleteAlert}
        onClearAll={alertCenter.clearAllAlerts}
        onUpdatePreferences={alertCenter.updatePreferences}
      />
    </ScreenScaffold>
  );
}
