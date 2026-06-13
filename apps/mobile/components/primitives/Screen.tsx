import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';

export type ScreenProps = {
  children: ReactNode;
  /** Apply default horizontal+vertical padding (p-4). Defaults to true. */
  padded?: boolean;
  /** Wrap content in a ScrollView. Defaults to false. */
  scroll?: boolean;
  /** When the screen renders its own top chrome (e.g. AppHeader) that should
   * extend behind the OS status bar, set false so SafeAreaView doesn't claim
   * the top inset with the surface background. Defaults to true. */
  topInset?: boolean;
  /** Claim the bottom safe-area inset (home indicator / gesture bar) so footer
   * content isn't clipped. Defaults to true. Set false on bottom-tab screens
   * (the tab bar already reserves the bottom inset) and on screens that apply
   * insets.bottom themselves, to avoid double padding. */
  bottomInset?: boolean;
  testID?: string;
};

// Page-level wrapper. Sets the surface background, safe-area insets, and
// optional scroll/padding that keep content clear of OS chrome.
// Mirrors the prop API of apps/web/components/primitives/Screen.tsx while
// adding mobile-specific padded + scroll conveniences.
// testID is placed on the inner content container so callers can assert
// on the padding/bg classes that apply there.
export function Screen({
  children,
  padded = true,
  scroll = false,
  topInset = true,
  bottomInset = true,
  testID,
}: ScreenProps) {
  const contentClass = padded ? 'flex-1 bg-surface p-4' : 'flex-1 bg-surface';
  const Inner = scroll ? ScrollView : View;
  const edges: Edge[] = ['left', 'right'];
  if (topInset) edges.unshift('top');
  if (bottomInset) edges.push('bottom');
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={edges}>
      <Inner
        className={contentClass}
        testID={testID}
        {...(scroll ? { contentContainerClassName: contentClass } : {})}
      >
        {children}
      </Inner>
    </SafeAreaView>
  );
}
