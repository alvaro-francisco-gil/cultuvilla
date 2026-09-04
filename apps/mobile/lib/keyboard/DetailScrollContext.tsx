import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Lets a deep child of an entity detail screen (the comment composer) ask the
 * scaffold's ScrollView to reveal it when the keyboard opens. Optional: a
 * consumer rendered outside a scaffold gets `null` and does nothing.
 */
const DetailScrollContext = createContext<RefObject<ScrollView | null> | null>(null);

export function DetailScrollProvider({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<ScrollView | null>;
  children: ReactNode;
}) {
  return <DetailScrollContext.Provider value={scrollRef}>{children}</DetailScrollContext.Provider>;
}

export function useDetailScroll() {
  return useContext(DetailScrollContext);
}
