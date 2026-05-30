import { AlertCenterCard } from '@/components/AlertCenterCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useAlertCenter } from '@/store/useAlertCenter';

export default function AlertsScreen() {
  const alertCenter = useAlertCenter();

  return (
    <ScreenScaffold title="Alert Center" subtitle="Violation alerts and notification preferences." iconName="alerts">
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
