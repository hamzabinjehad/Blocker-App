import { AnimatedCard } from '@/components/AnimatedCard';
import { AccountabilityAuditCard } from '@/components/AccountabilityAuditCard';
import { AlertCenterCard } from '@/components/AlertCenterCard';
import { EmergencyUnlockCard } from '@/components/EmergencyUnlockCard';
import { ManagedModeNotice } from '@/components/ManagedModeNotice';
import { NetworkProtectionCard } from '@/components/NetworkProtectionCard';
import { ParentPinCard } from '@/components/ParentPinCard';
import { PermissionChecklistCard } from '@/components/PermissionChecklistCard';
import { ProfileManagerCard } from '@/components/ProfileManagerCard';
import { RemoteManagementCard } from '@/components/RemoteManagementCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { TamperCard } from '@/components/TamperCard';
import { ThemeSettingsCard } from '@/components/ThemeSettingsCard';
import { useAlertCenter } from '@/store/useAlertCenter';
import { useEmergencyUnlock } from '@/store/useEmergencyUnlock';
import { useProfiles } from '@/store/useProfiles';
import { useProtectionState } from '@/store/useProtectionState';
import { useRemoteManagement } from '@/store/useRemoteManagement';

export default function AdminScreen() {
  const protection = useProtectionState();
  const remote = useRemoteManagement();
  const emergencyUnlock = useEmergencyUnlock();
  const profiles = useProfiles();
  const alertCenter = useAlertCenter();

  return (
    <ScreenScaffold title="Admin" subtitle="Remote management, profiles, alerts, and system protection." iconName="admin">
      <AnimatedCard>
        <RemoteManagementCard
          session={remote.session}
          loading={remote.loading}
          onGeneratePairingCode={remote.generateNewPairingCode}
          onAddDevice={remote.addDevice}
          onRemoveDevice={remote.removeDevice}
          onSubmitUnlockRequest={remote.submitUnlockRequest}
          onRespondToUnlockRequest={remote.respondToUnlockRequest}
        />
      </AnimatedCard>

      <AnimatedCard delay={30}>
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
      </AnimatedCard>

      <AnimatedCard delay={50}>
        <EmergencyUnlockCard
          state={emergencyUnlock.state}
          loading={emergencyUnlock.loading}
          pinConfigured={protection.pinConfigured}
          onCreatePasscode={emergencyUnlock.createPasscode}
          onActivatePasscode={emergencyUnlock.activatePasscode}
          onRevokePasscode={emergencyUnlock.revokePasscode}
          onEndEmergencyUnlock={emergencyUnlock.endEmergencyUnlock}
        />
      </AnimatedCard>

      <AnimatedCard delay={70}>
        <ProfileManagerCard
          profiles={profiles.profiles}
          activeProfile={profiles.activeProfile}
          loading={profiles.loading}
          onCreateProfile={profiles.createProfile}
          onSwitchProfile={profiles.switchProfile}
          onUpdateName={profiles.updateProfileName}
          onDeleteProfile={profiles.deleteProfile}
          onResetToPreset={profiles.resetToPreset}
        />
      </AnimatedCard>

      <AnimatedCard delay={90}>
        <PermissionChecklistCard
          accessibilityServiceEnabled={protection.accessibilityServiceEnabled}
          batteryOptimizationIgnored={protection.batteryOptimizationStatus.ignored}
          deviceAdminActive={protection.managedDeviceStatus.deviceAdminActive}
          overlayPermissionGranted={protection.overlayPermissionGranted}
          usageAccessGranted={protection.usageAccessStatus.granted}
          vpnPermissionGranted={protection.vpnPermissionGranted}
          onGrantVpnPermission={protection.prepareVpn}
          onOpenAccessibilitySettings={protection.openAccessibilitySettings}
          onOpenOverlaySettings={protection.openOverlaySettings}
          onOpenUsageAccessSettings={protection.openUsageAccessSettings}
          onRequestIgnoreBatteryOptimizations={protection.requestIgnoreBatteryOptimizations}
          onRequestDeviceAdminPermission={protection.requestDeviceAdminPermission}
        />
      </AnimatedCard>

      <AnimatedCard delay={110}>
        <NetworkProtectionCard
          alwaysOnVpnLocked={protection.managedEnforcementStatus.alwaysOnVpnLockdownEnabled}
          httpsInspection={protection.httpsInspectionStatus}
          vpnPolicy={protection.vpnPolicyStatus}
          onSetHttpsInspectionEnabled={protection.setHttpsInspectionEnabled}
          onUpdateVpnPolicy={protection.updateVpnPolicy}
        />
      </AnimatedCard>

      <AnimatedCard delay={130}>
        <TamperCard
          batteryOptimizationIgnored={protection.batteryOptimizationStatus.ignored}
          overlayPermissionGranted={protection.overlayPermissionGranted}
          strictModeEnabled={protection.strictModeEnabled}
          tamperReport={protection.tamperReport}
          tampered={protection.tampered}
          usageAccessStatus={protection.usageAccessStatus}
          vpnActive={protection.vpnActive}
          onOpenOverlaySettings={protection.openOverlaySettings}
          onOpenUsageAccessSettings={protection.openUsageAccessSettings}
          onRequestIgnoreBatteryOptimizations={protection.requestIgnoreBatteryOptimizations}
        />
      </AnimatedCard>

      <AnimatedCard delay={150}>
        <ThemeSettingsCard />
      </AnimatedCard>

      <AnimatedCard delay={170}>
        <ParentPinCard
          pinConfigured={protection.pinConfigured}
          loading={protection.loading}
          onSetPin={protection.setParentPin}
        />
      </AnimatedCard>

      <AnimatedCard delay={170}>
        <AccountabilityAuditCard
          auditEventCount={protection.auditEventCount}
          guardianAlertCount={protection.guardianAlertCount}
          guardianAlerts={protection.guardianAlerts}
          integrityStatus={protection.integrityStatus}
          mediaScanningStatus={protection.mediaScanningStatus}
          pinConfigured={protection.pinConfigured}
          safeModeBoot={protection.safeModeBoot}
          screenshotAuditPolicy={protection.screenshotAuditPolicy}
          onClearGuardianAlert={protection.clearGuardianAlert}
          onExportAuditEvents={protection.exportAuditEventsToClipboard}
          onRefreshGuardianAlerts={protection.refreshGuardianAlerts}
          onUpdateScreenshotAuditPolicy={protection.updateScreenshotAuditPolicy}
        />
      </AnimatedCard>

      <AnimatedCard delay={190}>
        <ManagedModeNotice
          batteryOptimizationIgnored={protection.batteryOptimizationStatus.ignored}
          error={protection.error}
          enforcement={protection.managedEnforcementStatus}
          status={protection.managedDeviceStatus}
          onCopyDeviceOwnerCommand={protection.copyDeviceOwnerEnrollmentCommand}
          onConfigureManagedPrivateDns={protection.configureManagedPrivateDns}
          onOpenPrivateDnsSettings={protection.openPrivateDnsSettings}
          onApplyStrictDeviceOwnerPolicy={protection.applyStrictDeviceOwnerPolicy}
          onRefreshStatus={() => protection.refreshStatus(false)}
          onRequestIgnoreBatteryOptimizations={protection.requestIgnoreBatteryOptimizations}
          onRequestDeviceAdminPermission={protection.requestDeviceAdminPermission}
          onSetAlwaysOnVpnLockdown={protection.setAlwaysOnVpnLockdown}
          onSetEmergencyLockEnabled={protection.setEmergencyLockEnabled}
          onSetPackageSuspensionEnabled={protection.setPackageSuspensionEnabled}
          onSetStrictModeEnabled={protection.setStrictModeEnabled}
          onSetUninstallProtectionEnabled={protection.setUninstallProtectionEnabled}
        />
      </AnimatedCard>
    </ScreenScaffold>
  );
}
