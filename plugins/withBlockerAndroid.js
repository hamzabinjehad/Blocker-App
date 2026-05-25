const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const VPN_SERVICE = 'com.example.blocker.FilterVpnService';
const BEHAVIOR_ACCESSIBILITY_SERVICE = 'com.example.blocker.behavior.BehaviorAccessibilityService';
const BLOCK_OVERLAY_SERVICE = 'com.example.blocker.BlockOverlayService';
const CONTENT_NOTIFICATION_LISTENER = 'com.example.blocker.ContentNotificationListener';
const BOOT_RECEIVER = 'com.example.blocker.BootReceiver';
const DEVICE_ADMIN_RECEIVER = 'com.example.blocker.BlockerDeviceAdminReceiver';
const PACKAGE_CHANGE_RECEIVER = 'com.example.blocker.PackageChangeReceiver';
const UNINSTALL_LOCK_RECEIVER = 'com.example.blocker.UninstallLockReceiver';
const VPN_RESTART_JOB_SERVICE = 'com.example.blocker.VpnRestartJobService';
const SPECIAL_USE_PROPERTY = 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE';

const permissions = [
  'android.permission.INTERNET',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const blockedPermissions = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.VIBRATE',
];

const withBlockerAndroid = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, permissions);
  config = AndroidConfig.Permissions.withBlockedPermissions(config, blockedPermissions);

  return withAndroidManifest(config, (manifestConfig) => {
    const androidManifest = manifestConfig.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
    mainApplication.$['android:allowBackup'] = 'false';
    mainApplication.$['android:fullBackupContent'] = 'false';

    mainApplication.service = upsertByName(mainApplication.service || [], VPN_SERVICE, {
      $: {
        'android:name': VPN_SERVICE,
        'android:exported': 'false',
        'android:permission': 'android.permission.BIND_VPN_SERVICE',
        'android:foregroundServiceType': 'specialUse',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.net.VpnService' } }],
        },
      ],
      property: [
        {
          $: {
            'android:name': SPECIAL_USE_PROPERTY,
            'android:value':
              'Visible local parental-control VPN for DNS/domain and scoped app traffic filtering; optional HTTPS proxy host filtering after consent.',
          },
        },
      ],
    });

    mainApplication.service = upsertByName(mainApplication.service || [], BEHAVIOR_ACCESSIBILITY_SERVICE, {
      $: {
        'android:name': BEHAVIOR_ACCESSIBILITY_SERVICE,
        'android:exported': 'false',
        'android:label': 'Behavior Protection',
        'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.accessibilityservice',
            'android:resource': '@xml/blocker_accessibility_service',
          },
        },
      ],
    });

    mainApplication.service = upsertByName(mainApplication.service || [], BLOCK_OVERLAY_SERVICE, {
      $: {
        'android:name': BLOCK_OVERLAY_SERVICE,
        'android:exported': 'false',
        'android:foregroundServiceType': 'specialUse',
      },
      property: [
        {
          $: {
            'android:name': SPECIAL_USE_PROPERTY,
            'android:value':
              'Visible parental-control blocking overlay shown above unsafe content or tamper attempts after explicit overlay permission.',
          },
        },
      ],
    });

    mainApplication.receiver = upsertByName(mainApplication.receiver || [], BOOT_RECEIVER, {
      $: {
        'android:name': BOOT_RECEIVER,
        'android:directBootAware': 'true',
        'android:enabled': 'true',
        'android:exported': 'false',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.LOCKED_BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
            { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
          ],
        },
      ],
    });

    mainApplication.receiver = upsertByName(mainApplication.receiver || [], DEVICE_ADMIN_RECEIVER, {
      $: {
        'android:name': DEVICE_ADMIN_RECEIVER,
        'android:description': '@string/blocker_device_admin_description',
        'android:exported': 'true',
        'android:label': '@string/blocker_device_admin_title',
        'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
      },
      'meta-data': [
        {
          $: {
            'android:name': 'android.app.device_admin',
            'android:resource': '@xml/blocker_device_admin',
          },
        },
      ],
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } }],
        },
      ],
    });

    mainApplication.receiver = upsertByName(mainApplication.receiver || [], PACKAGE_CHANGE_RECEIVER, {
      $: {
        'android:name': PACKAGE_CHANGE_RECEIVER,
        'android:enabled': 'true',
        'android:exported': 'false',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.PACKAGE_ADDED' } },
            { $: { 'android:name': 'android.intent.action.PACKAGE_REPLACED' } },
            { $: { 'android:name': 'android.intent.action.PACKAGE_REMOVED' } },
          ],
          data: [{ $: { 'android:scheme': 'package' } }],
        },
      ],
    });

    mainApplication.receiver = upsertByName(mainApplication.receiver || [], UNINSTALL_LOCK_RECEIVER, {
      $: {
        'android:name': UNINSTALL_LOCK_RECEIVER,
        'android:enabled': 'true',
        'android:exported': 'false',
      },
    });

    mainApplication.service = upsertByName(mainApplication.service || [], VPN_RESTART_JOB_SERVICE, {
      $: {
        'android:name': VPN_RESTART_JOB_SERVICE,
        'android:exported': 'false',
        'android:permission': 'android.permission.BIND_JOB_SERVICE',
      },
    });

    mainApplication.service = upsertByName(mainApplication.service || [], CONTENT_NOTIFICATION_LISTENER, {
      $: {
        'android:name': CONTENT_NOTIFICATION_LISTENER,
        'android:exported': 'false',
        'android:label': 'Content Notification Filter',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }],
        },
      ],
    });

    return manifestConfig;
  });
};

function upsertByName(items, name, next) {
  const index = items.findIndex((item) => item.$['android:name'] === name);
  if (index === -1) {
    return [...items, next];
  }
  const clone = [...items];
  clone[index] = next;
  return clone;
}

module.exports = withBlockerAndroid;
