import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, elevation } from '@cultuvilla/shared/design-system';
import { Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { isWeb } from '../../lib/platform';
import { edgeState, pageScrollTarget, type Edges, type HScrollNode } from '../../lib/horizontalScroll';

const ACCENT = '#bb5d3a'; // palette.terracotta — matches VillageSections cards

/** RN-Web's ScrollView & FlatList both expose this; used to reach the DOM node. */
interface ScrollableInstance {
  getScrollableNode?: () => unknown;
}

/** The DOM node `getScrollableNode()` returns on web. */
interface ScrollNodeDom extends HScrollNode {
  scrollTo?: (opts: { left: number; behavior?: 'smooth' | 'auto' }) => void;
  addEventListener: (type: 'scroll', listener: () => void, options?: { passive?: boolean }) => void;
  removeEventListener: (type: 'scroll', listener: () => void) => void;
}

/**
 * Wraps a horizontal `FlatList`/`ScrollView` and, on **non-touch desktop
 * screens only**, overlays prev/next arrow buttons that page the row. On such a
 * screen the row moves *only* via the arrows — there is no wheel/scrollbar
 * free-scroll — which is why this is the sole desktop affordance. Both arrows
 * stay mounted and fade/disable at the edges rather than unmounting: unmounting
 * an arrow between a mouse-down and mouse-up (which a still-settling scroll can
 * trigger) would swallow the click. Entirely inert on native and on touch
 * screens, so phone behaviour (touch-drag) is unchanged.
 *
 * Render-prop: pass the list as `children`, spreading the provided ref onto it:
 *   <HorizontalScrollRow>
 *     {(scrollRef) => <FlatList ref={scrollRef} horizontal … />}
 *   </HorizontalScrollRow>
 */
export function HorizontalScrollRow({
  children,
}: {
  children: (scrollRef: (instance: ScrollableInstance | null) => void) => ReactNode;
}) {
  const nodeRef = useRef<ScrollNodeDom | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [edges, setEdges] = useState<Edges>({ left: false, right: false });
  const [isDesktop, setIsDesktop] = useState(false);

  // "Non-touchable screen" = a fine, hovering pointer (a mouse). Reactive so a
  // hybrid device that switches input method updates live.
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  const scrollRef = useCallback((instance: ScrollableInstance | null) => {
    cleanup.current?.();
    cleanup.current = null;
    nodeRef.current = null;
    if (!isWeb || !instance) return;
    const node = instance.getScrollableNode?.() as ScrollNodeDom | undefined;
    if (!node || typeof node.addEventListener !== 'function') return;
    nodeRef.current = node;
    const recompute = () => setEdges(edgeState(node));
    node.addEventListener('scroll', recompute, { passive: true });
    // Recompute when the content resizes — images load in after mount and grow
    // the scrollable width, which changes whether the right arrow should show.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(recompute);
      ro.observe(node as unknown as Element);
    }
    recompute();
    cleanup.current = () => {
      node.removeEventListener('scroll', recompute);
      ro?.disconnect();
    };
  }, []);

  const scrollBy = useCallback((dir: 'left' | 'right') => {
    const node = nodeRef.current;
    if (!node) return;
    const left = pageScrollTarget(node, dir);
    if (typeof node.scrollTo === 'function') node.scrollTo({ left, behavior: 'smooth' });
    else node.scrollLeft = left;
  }, []);

  return (
    <View style={{ position: 'relative' }}>
      {children(scrollRef)}
      {isDesktop ? (
        <>
          <ArrowButton dir="left" active={edges.left} onPress={() => scrollBy('left')} />
          <ArrowButton dir="right" active={edges.right} onPress={() => scrollBy('right')} />
        </>
      ) : null}
    </View>
  );
}

const BTN = 36;

function ArrowButton({
  dir,
  active,
  onPress,
}: {
  dir: 'left' | 'right';
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      // Stays mounted always; when it can't scroll that way it's just invisible
      // and non-interactive (pointerEvents:none) — so it never covers a card and
      // never unmounts mid-click (the bug that dropped arrow clicks).
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      accessibilityLabel={t(dir === 'left' ? 'common.carousel.prev' : 'common.carousel.next')}
      style={{
        position: 'absolute',
        top: '50%',
        transform: [{ translateY: -BTN / 2 }],
        ...(dir === 'left' ? { left: 6 } : { right: 6 }),
        width: BTN,
        height: BTN,
        borderRadius: BTN / 2,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        opacity: active ? 1 : 0,
        ...elevation.md.rn,
      }}
    >
      <Ionicons
        name={dir === 'left' ? 'chevron-back' : 'chevron-forward'}
        size={iconSizes.md}
        color={ACCENT}
      />
    </Pressable>
  );
}
