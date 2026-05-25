import type { ConfigContext, ExpoConfig } from 'expo/config';

import withBlockerAndroid from './plugins/withBlockerAndroid.js';

export default ({ config }: ConfigContext): ExpoConfig => {
  const expoConfig: ExpoConfig = {
    ...config,
    name: 'Parent Blocker MVP',
    slug: 'parent-blocker-mvp',
    version: '1.0.0',
    platforms: ['android'],
    orientation: 'portrait',
    icon: './assets/icon.png',
    newArchEnabled: true,
    scheme: 'parentblocker',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    android: {
      package: 'com.example.parentblocker',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    plugins: ['expo-router'],
  };

  return withBlockerAndroid(expoConfig);
};
