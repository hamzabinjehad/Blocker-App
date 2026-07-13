import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockGetStatus = jest.fn();
const mockStartProtection = jest.fn();
const mockStopProtection = jest.fn();
const mockSetPin = jest.fn();
const mockPrepareVpn = jest.fn();
const mockGetGuardianAlerts = jest.fn();
const mockGetLaunchableApps = jest.fn();
const mockRequestDeviceAdminPermission = jest.fn();
const mockSetImageScanningEnabled = jest.fn();

jest.mock('../../native/BlockerModule', () => ({
  __esModule: true,
  default: {
    getStatus: mockGetStatus,
    getGuardianAlerts: mockGetGuardianAlerts,
    getLaunchableApps: mockGetLaunchableApps,
    prepareVpn: mockPrepareVpn,
    startProtection: mockStartProtection,
    stopProtection: mockStopProtection,
    requestDeviceAdminPermission: mockRequestDeviceAdminPermission,
    setImageScanningEnabled: mockSetImageScanningEnabled,
    setPin: mockSetPin,
    // Plain functions (not jest.fn) so resetAllMocks can't strip the implementations
    // that unmount cleanup depends on.
    addListener: () => ({ remove: () => {} }),
    removeListeners: () => {},
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
    currentState: 'active',
  },
}));

const { useProtectionState } = require('../useProtectionState');

const defaultStatus = {
  status: 'inactive' as const,
  vpnActive: false,
  tampered: false,
  protectionRequested: false,
  vpnRuntimeState: 'inactive' as const,
  vpnStartFailure: null,
  vpnStartupRemainingMs: 0,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('useProtectionState', () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) also drops queued mock*Once values, so a test
    // that leaves an unconsumed Once can't poison the next test's first getStatus call.
    jest.resetAllMocks();
    mockGetStatus.mockResolvedValue(defaultStatus);
    mockGetGuardianAlerts.mockResolvedValue([]);
    mockGetLaunchableApps.mockResolvedValue([]);
    mockSetImageScanningEnabled.mockResolvedValue(undefined);
    mockPrepareVpn.mockResolvedValue({ granted: true, needsPermission: false });
    mockRequestDeviceAdminPermission.mockResolvedValue({
      permissionRequested: true,
      managedDeviceStatus: { deviceAdminActive: false },
    });
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
    expect(result.current.statusVerified).toBe(true);
    expect(result.current.pinConfigured).toBe(true);
  });

  it('keeps startup non-active until a polled status verifies the VPN tunnel', async () => {
    jest.useFakeTimers();
    mockGetStatus
      .mockResolvedValueOnce({
        ...defaultStatus,
        managedDeviceStatus: { deviceAdminActive: true },
      })
      .mockResolvedValueOnce({
        ...defaultStatus,
        status: 'starting',
        protectionRequested: true,
        vpnRuntimeState: 'starting',
        vpnStartupRemainingMs: 500,
        managedDeviceStatus: { deviceAdminActive: true },
      })
      .mockResolvedValueOnce({
        ...defaultStatus,
        status: 'active',
        vpnActive: true,
        protectionRequested: true,
        vpnRuntimeState: 'active',
        managedDeviceStatus: { deviceAdminActive: true },
      });
    mockStartProtection.mockResolvedValueOnce({ status: 'starting', vpnActive: false });

    const { result, unmount } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.managedDeviceStatus.deviceAdminActive).toBe(true);
    });

    await act(async () => {
      await result.current.startProtection();
    });

    expect(result.current.status).toBe('starting');
    expect(result.current.statusVerified).toBe(true);
    expect(result.current.vpnActive).toBe(false);
    expect(mockSetImageScanningEnabled).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('active');
      expect(result.current.vpnActive).toBe(true);
    });
    expect(result.current.statusVerified).toBe(true);
    expect(mockSetImageScanningEnabled).not.toHaveBeenCalled();

    unmount();
    jest.useRealTimers();
  });

  it('hydrates image scanning preferences without rewriting native policy', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      status: 'active',
      vpnActive: true,
      mediaScanningStatus: {
        enabled: false,
        blockThreshold: 0.92,
      },
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.status).toBe('active');
    });

    expect(result.current.imageScanningEnabled).toBe(false);
    expect(result.current.scanSensitivity).toBe('conservative');
    expect(mockSetImageScanningEnabled).not.toHaveBeenCalled();
  });

  it('startProtection calls native module', async () => {
    mockStartProtection.mockResolvedValueOnce({ status: 'active' });
    mockGetStatus
      .mockResolvedValueOnce({
        ...defaultStatus,
        managedDeviceStatus: { deviceAdminActive: true },
      })
      .mockResolvedValueOnce({
        ...defaultStatus,
        status: 'active',
        vpnActive: true,
        managedDeviceStatus: { deviceAdminActive: true },
      });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.managedDeviceStatus.deviceAdminActive).toBe(true);
    });

    await act(async () => {
      await result.current.startProtection();
    });

    expect(mockStartProtection).toHaveBeenCalledWith(7);
  });

  it('handles getStatus failure gracefully', async () => {
    mockGetStatus.mockRejectedValueOnce(new Error('Native module error'));

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    expect(result.current.status).toBe('inactive');
    expect(result.current.statusVerified).toBe(false);
  });

  it('invalidates a previously active status when a later getStatus call fails', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      status: 'active',
      vpnActive: true,
      protectionRequested: true,
      vpnRuntimeState: 'active',
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.vpnActive).toBe(true);
    });

    mockGetStatus.mockRejectedValueOnce(new Error('Status bridge unavailable'));
    await act(async () => {
      await result.current.refreshStatus(false);
    });

    expect(result.current.status).toBe('inactive');
    expect(result.current.vpnActive).toBe(false);
    expect(result.current.statusVerified).toBe(false);
    expect(result.current.error).toBe('Status bridge unavailable');
  });

  it('keeps a verified tunnel signal while reporting a separate tamper state', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      status: 'tampered',
      vpnActive: true,
      tampered: true,
      protectionRequested: true,
      vpnRuntimeState: 'active',
    });

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.status).toBe('tampered');
    });

    expect(result.current.statusVerified).toBe(true);
    expect(result.current.vpnActive).toBe(true);
    expect(result.current.tampered).toBe(true);
  });

  it('keeps verified protection state when guardian alert refresh fails', async () => {
    mockGetStatus.mockResolvedValueOnce({
      ...defaultStatus,
      status: 'active',
      vpnActive: true,
      protectionRequested: true,
      vpnRuntimeState: 'active',
    });
    mockGetGuardianAlerts.mockRejectedValueOnce(new Error('Guardian alerts unavailable'));

    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.guardianAlertsError).toBe('Guardian alerts unavailable');
    });

    expect(result.current.status).toBe('active');
    expect(result.current.vpnActive).toBe(true);
    expect(result.current.statusVerified).toBe(true);
    expect(result.current.hydrated).toBe(true);
  });

  it('ignores an older status refresh that settles after a newer refresh', async () => {
    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    const older = deferred<Record<string, unknown>>();
    const newer = deferred<Record<string, unknown>>();
    mockGetStatus
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);

    let olderRefresh!: Promise<void>;
    let newerRefresh!: Promise<void>;
    act(() => {
      olderRefresh = result.current.refreshStatus(true);
      newerRefresh = result.current.refreshStatus(false);
    });

    await act(async () => {
      newer.resolve({
        ...defaultStatus,
        status: 'active',
        vpnActive: true,
        protectionRequested: true,
        vpnRuntimeState: 'active',
        blockedDomainCount: 99,
      });
      await newerRefresh;
    });
    expect(result.current.status).toBe('active');
    expect(result.current.vpnActive).toBe(true);
    expect(result.current.blockedDomainCount).toBe(99);
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      older.reject(new Error('Stale status error'));
      await olderRefresh;
    });
    expect(result.current.status).toBe('active');
    expect(result.current.vpnActive).toBe(true);
    expect(result.current.blockedDomainCount).toBe(99);
    expect(result.current.error).toBeUndefined();
  });

  it('ignores an older guardian-alert refresh that resolves last', async () => {
    const { result } = renderHook(() => useProtectionState());
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    const older = deferred<Array<Record<string, unknown>>>();
    const newer = deferred<Array<Record<string, unknown>>>();
    mockGetGuardianAlerts
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);

    let olderRefresh!: Promise<void>;
    let newerRefresh!: Promise<void>;
    act(() => {
      olderRefresh = result.current.refreshGuardianAlerts();
      newerRefresh = result.current.refreshGuardianAlerts();
    });

    await act(async () => {
      newer.resolve([
        { id: 'new', eventType: 'VPN', severity: 'high', subject: 'New', action: 'noted', timestamp: 2, cleared: false },
      ]);
      await newerRefresh;
    });
    await act(async () => {
      older.resolve([
        { id: 'old', eventType: 'VPN', severity: 'low', subject: 'Old', action: 'noted', timestamp: 1, cleared: false },
      ]);
      await olderRefresh;
    });

    expect(result.current.guardianAlerts.map((alert: { id: string }) => alert.id)).toEqual(['new']);
    expect(result.current.guardianAlertCount).toBe(1);
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
