import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { IntroOverlay } from './IntroOverlay';

const MarkAppReadyContext = createContext<() => void>(() => {});

/**
 * Renders the app with the startup intro on top. The app mounts and loads
 * underneath while the intro plays; whoever knows the first real screen is up
 * calls `useMarkAppReady()` so the intro can hand over.
 *
 * The ready flag lives here rather than in the root layout so flipping it
 * re-renders only the overlay, not the whole provider tree passed as children.
 */
export function IntroHost({ children }: { children: ReactNode }) {
  const [appReady, setAppReady] = useState(false);
  const markAppReady = useCallback(() => setAppReady(true), []);
  return (
    <MarkAppReadyContext.Provider value={markAppReady}>
      <View style={{ flex: 1 }}>
        {children}
        <IntroOverlay appReady={appReady} />
      </View>
    </MarkAppReadyContext.Provider>
  );
}

export function useMarkAppReady(): () => void {
  return useContext(MarkAppReadyContext);
}
