import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';

type AppSheetProps = PropsWithChildren<{
  visible: boolean;
  /** Called when the user dismisses (backdrop tap, drag down, back button). */
  onClose: () => void;
  /** Set false to force closing through an explicit action (no backdrop/drag dismiss). */
  dismissable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

// Single bottom-sheet primitive for the app: slide/fade driven by reanimated on
// the UI thread, drag-down-to-dismiss via gesture-handler, themed, RTL-safe.
// Hosted in a transparent RN Modal so it reliably layers above everything —
// including other RN Modals — with no portal machinery.
export function AppSheet({ visible, onClose, dismissable = true, contentStyle, children }: AppSheetProps) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The Modal stays mounted through the exit animation, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0); // 0 = hidden below screen, 1 = fully shown
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      progress.value = withSpring(1, { damping: 22, mass: 0.9, stiffness: 240 });
    } else {
      progress.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [dragY, progress, visible]);

  const requestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  const pan = Gesture.Pan()
    .enabled(dismissable)
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, { damping: 20, mass: 0.8, stiffness: 260 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.32 }));
  const sheetStyle = useAnimatedStyle(() => {
    const hidden = sheetHeight.value > 0 ? sheetHeight.value : windowHeight;
    return { transform: [{ translateY: (1 - progress.value) * hidden + dragY.value }] };
  });

  if (!mounted) return null;

  return (
    <Modal statusBarTranslucent transparent visible onRequestClose={requestClose}>
      {/* Gesture handlers need their own root inside an RN Modal on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={requestClose}>
            <Animated.View style={[styles.fill, styles.backdrop, backdropStyle]} />
          </Pressable>
          <GestureDetector gesture={pan}>
            <Animated.View
              accessibilityViewIsModal
              onLayout={(event) => {
                sheetHeight.value = event.nativeEvent.layout.height;
              }}
              style={[
                styles.sheet,
                { backgroundColor: colors.bg.elevated, maxHeight: windowHeight * 0.88 },
                sheetStyle,
              ]}
            >
              <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
              <ScrollView
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: Math.max(insets.bottom, spacing.lg) },
                  contentStyle,
                ]}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: '#151A17',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    borderRadius: radius.full,
    height: 4,
    width: 32,
  },
  content: {
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.md,
  },
});
