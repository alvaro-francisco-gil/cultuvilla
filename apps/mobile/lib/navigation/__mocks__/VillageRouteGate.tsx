import type { ReactNode } from 'react';

/**
 * Test double for the pueblo-slug gate: renders the screen straight away with a
 * fixed village, so a screen test exercises the screen and not the slug lookup
 * (which has its own tests). Opt in with `jest.mock('<path>/VillageRouteGate')`.
 */
export const mockVillageRoute = { municipalityId: 'm1', slug: 'villa' };

export function VillageRouteGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useVillageRoute() {
  return mockVillageRoute;
}

export function withVillageRoute<P extends object>(Screen: (props: P) => ReactNode) {
  return Screen;
}
