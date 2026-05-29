import { AnimatedCard } from '@/components/AnimatedCard';
import { AccountabilityAuditCard } from '@/components/AccountabilityAuditCard';
import { AlertCenterCard } from '@/components/AlertCenterCard';
import { DisclosureSection } from '@/components/DisclosureSection';
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
    <ScreenScaffold title="Guardian" subtitle="Accountability, alerts, PIN, and protected overrides." iconName="guardian">
      <AnimatedCard>
        <DisclosureSection defaultOpen title="Remote" subtitle="Pairing, guardians, and unlock requests">
          <RemoteManagementCard
            session={remote.session}
            loading={remote.loading}
            onGeneratePairingCode={remote.generateNewPairingCode}
            onAddDevice={remote.addDevice}
            onRemoveDevice={remote.removeDevice}
            onSubmitUnlockRequest={remote.submitUnlockRequest}
            onRespondToUnlockRequest={remote.respondToUnlockRequest}
          />
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
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={30}>
        <DisclosureSection title="Alerts" subtitle={`${alertCenter.unreadCount} unread notification${alertCenter.unreadCount === 1 ? '' : 's'}`}>
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
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={50}>
        <DisclosureSection title="Safety" subtitle="Emergency unlock, PIN, and tamper checks">
          <EmergencyUnlockCard
            state={emergencyUnlock.state}
            loading={emergencyUnlock.loading}
            pinConfigured={protection.pinConfigured}
            onCreatePasscode={emergencyUnlock.createPasscode}
            onActivatePasscode={emergencyUnlock.activatePasscode}
            onRevokePasscode={emergencyUnlock.revokePasscode}
            onEndEmergencyUnlock={emergencyUnlock.endEmergencyUnlock}
          />
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
          <ParentPinCard
            pinConfigured={protection.pinConfigured}
            loading={protection.loading}
            onSetPin={protection.setParentPin}
          />
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={70}>
        <DisclosureSection title="Permissions" subtitle="Android access needed for protection">
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
          <NetworkProtectionCard
            alwaysOnVpnLocked={protection.managedEnforcementStatus.alwaysOnVpnLockdownEnabled}
            httpsInspection={protection.httpsInspectionStatus}
            vpnPolicy={protection.vpnPolicyStatus}
            onSetHttpsInspectionEnabled={protection.setHttpsInspectionEnabled}
            onUpdateVpnPolicy={protection.updateVpnPolicy}
          />
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={90}>
        <DisclosureSection title="Advanced" subtitle="Appearance, audit exports, and managed-device controls">
          <ThemeSettingsCard />
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
        </DisclosureSection>
      </AnimatedCard>
    </ScreenScaffold>
  );
}
