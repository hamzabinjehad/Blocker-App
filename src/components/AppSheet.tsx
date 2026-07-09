import { useCallback, useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { radius, spacing, useTheme } from '@/theme';

type AppSheetProps = PropsWithChildren<{
  visible: boolean;
  /** Called after the sheet is fully dismissed (backdrop tap, drag down, or visible=false). */
  onClose: () => void;
  /** Set false to force closing through an explicit action (no backdrop/drag dismiss). */
  dismissable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

// Single bottom-sheet primitive for the app: gesture-dismissable, sized to its
// content, themed, and keyboard-aware. Declarative `visible` API so consumers
// keep their existing boolean state.
//
// CAVEAT: sheets render through BottomSheetModalProvider at the app root, so
// they appear BELOW any native RN `Modal` that is currently open. A sheet that
// must layer above an RN Modal (e.g. UrgeSurfingSheet inside the block-screen
// overlay) cannot use AppSheet.
export function AppSheet({ visible, onClose, dismissable = true, contentStyle, children }: AppSheetProps) {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.32}
        pressBehavior={dismissable ? 'close' : 'none'}
      />
    ),
    [dismissable],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.bg.elevated,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
      }}
      enableDynamicSizing
      enablePanDownToClose={dismissable}
      handleIndicatorStyle={{ backgroundColor: colors.border.default, height: 4, width: 32 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onClose}
    >
      <BottomSheetView style={[{ gap: spacing.md, padding: spacing.xl, paddingTop: spacing.md }, contentStyle]}>
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
