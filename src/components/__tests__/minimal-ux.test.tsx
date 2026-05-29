import { fireEvent, render, screen } from '@testing-library/react-native';

import { DisclosureSection } from '@/components/DisclosureSection';
import { HeroStatusCard } from '@/components/HeroStatusCard';
import { PermissionChecklistCard } from '@/components/PermissionChecklistCard';

const noopAsync = async () => {};

describe('minimal UX surfaces', () => {
  it('keeps the home hero focused on protection and clean time', () => {
    render(<HeroStatusCard cleanMinutes={125} isProtected={false} onToggle={jest.fn()} />);

    expect(screen.getByText('Protection paused')).toBeTruthy();
    expect(screen.getByText('2h 5m')).toBeTruthy();
    expect(screen.getByText('Start Protection')).toBeTruthy();
    expect(screen.queryByText('Level')).toBeNull();
  });

  it('summarizes missing setup work in the permission checklist', () => {
    render(
      <PermissionChecklistCard
        accessibilityServiceEnabled
        batteryOptimizationIgnored={false}
        deviceAdminActive={false}
        onGrantVpnPermission={noopAsync}
        onOpenAccessibilitySettings={noopAsync}
        onOpenOverlaySettings={noopAsync}
        onOpenUsageAccessSettings={noopAsync}
        onRequestDeviceAdminPermission={noopAsync}
        onRequestIgnoreBatteryOptimizations={noopAsync}
        overlayPermissionGranted
        usageAccessGranted
        vpnPermissionGranted
      />,
    );

    expect(screen.getByText('Finish setup')).toBeTruthy();
    expect(screen.getByText('2 permissions need attention.')).toBeTruthy();
  });

  it('hides advanced content until a disclosure section is opened', () => {
    render(
      <DisclosureSection title="Advanced" subtitle="Extra controls">
        <PermissionChecklistCard
          accessibilityServiceEnabled
          batteryOptimizationIgnored
          deviceAdminActive
          onGrantVpnPermission={noopAsync}
          onOpenAccessibilitySettings={noopAsync}
          onOpenOverlaySettings={noopAsync}
          onOpenUsageAccessSettings={noopAsync}
          onRequestDeviceAdminPermission={noopAsync}
          onRequestIgnoreBatteryOptimizations={noopAsync}
          overlayPermissionGranted
          usageAccessGranted
          vpnPermissionGranted
        />
      </DisclosureSection>,
    );

    expect(screen.queryByText('Setup complete')).toBeNull();
    fireEvent.press(screen.getByText('Advanced'));
    expect(screen.getByText('Setup complete')).toBeTruthy();
  });
});
