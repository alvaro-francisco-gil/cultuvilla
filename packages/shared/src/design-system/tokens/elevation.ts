/**
 * Elevation/shadow tokens. Each level carries:
 *  - `web`: a CSS box-shadow value (consumed by Tailwind `boxShadow`).
 *  - `rn`: the React Native shadow shape (`shadowColor`, `shadowOffset`,
 *    `shadowOpacity`, `shadowRadius`, and Android's `elevation`).
 *
 * Three levels is deliberate. RN shadows are expensive to render; more
 * levels means more state to keep consistent across iOS/Android and more
 * temptation to invent ad-hoc "elevation 7" cases.
 */
export const elevation = {
  none: {
    web: 'none',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  sm: {
    web: '0 1px 2px rgba(0, 0, 0, 0.06)',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  md: {
    web: '0 4px 6px rgba(0, 0, 0, 0.10)',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 3,
    },
  },
} as const;

export type ElevationLevel = keyof typeof elevation;
