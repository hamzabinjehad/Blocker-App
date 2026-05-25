import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockGetStatus = jest.fn();
const mockStartProtection = jest.fn();
const mockStopProtection = jest.fn();
const mockSetPin = jest.fn();
const mockPrepareVpn = jest.fn();
const mockGetGuardianAlerts = jest.fn();
const mockGetLaunchableApps = jest.fn();

jest.mock('../../native/BlockerModule', () => ({
  __esModule: true,
  default: {
    getStatus: mockGetStatus,
    getGuardianAlerts: mockGetGuardianAlerts,
    getLaunchableApps: mockGetLaunchableApps,
    prepareVpn: mockPrepareVpn,
    startProtection: mockStartProtection,
    stopProtection: mockStopProtection,
    setPin: mockSetPin,
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

const { useProtectionState } = require('../useProtectionState');

const defaultStatus = {
  status: 'inactive' as const,
  vpnActive: false,
  tampered: false,
  vpnPermissionGranted: false,
  pinConfigured: false,
  blockedDomains: [],
  allowlistedDomains: [],
  blockedDomainCount: 0,
  lastBlocklistUpdate: 'Bundled development sample',
  accessibilityServiceEnabled: false,
  overlayPermissionGranted: false,
  strictModeEnabled: false,
  tamperReport: [],
  safeSearchSettings: null,
  riskySettings: null,
  usageAccessStatus: null,
  batteryOptimizationStatus: null,
  behaviorPolicy: null,
  privateDnsStatus: null,
  vpnPolicyStatus: null,
  httpsInspectionStatus: null,
  mediaScanningStatus: null,
  screenshotAuditPolicy: null,
  integrityStatus: null,
  safeModeBoot: false,
  auditEventCount: 0,
  guardianAlertCount: 0,
  guardianAlerts: [],
  anomalyDetectionStatus: null,
  managedDeviceStatus: null,
  managedEnforcementStatus: null,
  focusPolicy: null,
  focusState: null,
  usageLimitPolicy: null,
  installedApps: [],
  featureBlockSettings: null,
};

describe('useProtectionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStatus.mockResolvedValue(defaultStatus);
    mockGetGuardianAlerts.mockResolvedValue([]);
    mockGetLaunchableApps.mockResolvedValue([]);
    mockPrepareVpn.mockResolvedValue({ granted: true, needsPermission: false });
  });

  it('starts with protection inactive', async () => {
    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.status).toBe('inactive');
    });
    expect(result.current.vpnActive).toBe(false);
  });

  it('refreshStatus updates state from BlockerModule', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      status: 'active',
      vpnActive: true,
      tampered: false,
      pinConfigured: true,
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.status).toBe('active');
    });
    expect(result.current.vpnActive).toBe(true);
    expect(result.current.pinConfigured).toBe(true);
  });

  it('startProtection calls native module', async () => {
    mockStartProtection.mockResolvedValueOnce({ success: true });
    mockGetStatus
      .mockResolvedValueOnce(defaultStatus)
      .mockResolvedValueOnce({
        ...defaultStatus,
        status: 'active',
        vpnActive: true,
      });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.refreshStatus).toBeDefined();
    });

    await act(async () => {
      await result.current.startProtection();
    });

    expect(mockStartProtection).toHaveBeenCalled();
  });

  it('handles getStatus failure gracefully', async () => {
    mockGetStatus.mockRejectedValueOnce(new Error('Native module error'));
    mockGetLaunchableApps.mockRejectedValueOnce(new Error('Apps unavailable'));

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    expect(result.current.status).toBe('inactive');
  });

  it('tracks safe mode boot flag', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      safeModeBoot: true,
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.safeModeBoot).toBe(true);
    });
  });

  it('tracks tamper report signals', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      tamperReport: [
        { id: 'vpn_down', severity: 'critical', detected: true, subject: 'VPN', recommendation: 'Restart' },
      ],
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.tamperReport).toHaveLength(1);
    });
    expect(result.current.tamperReport[0].id).toBe('vpn_down');
  });
});
