import { render, fireEvent } from '@testing-library/react-native';
import { VillagesScroll, type VillageRow } from '../VillagesScroll';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));

const ROWS: VillageRow[] = [
  { municipalityId: 'm1', name: 'Pueblo Uno', comunidadAutonoma: 'Andalucía', escudoUrl: null, manualEscudo: false, role: 'user' },
  { municipalityId: 'm2', name: 'Pueblo Dos', comunidadAutonoma: 'Aragón', escudoUrl: null, manualEscudo: false, role: 'admin' },
  { municipalityId: 'm3', name: 'Pueblo Tres', comunidadAutonoma: 'Galicia', escudoUrl: null, manualEscudo: false, role: 'user' },
];

function setup(overrides: Partial<React.ComponentProps<typeof VillagesScroll>> = {}) {
  const onPressVillage = jest.fn();
  const onPressJoin = jest.fn();
  const utils = render(
    <VillagesScroll
      villages={ROWS}
      activeId="m1"
      joinLabel="Unirse a otro pueblo"
      emptyLabel="Aún no perteneces a ningún pueblo"
      onPressVillage={onPressVillage}
      onPressJoin={onPressJoin}
      {...overrides}
    />,
  );
  return { ...utils, onPressVillage, onPressJoin };
}

describe('VillagesScroll', () => {
  it('renders a card per village', () => {
    const { getByText } = setup();
    expect(getByText('Pueblo Uno')).toBeTruthy();
    expect(getByText('Pueblo Dos')).toBeTruthy();
  });

  it('shows the comunidad autónoma below each pueblo name', () => {
    const { getByText } = setup();
    expect(getByText('Andalucía')).toBeTruthy(); // m1
    expect(getByText('Aragón')).toBeTruthy(); // m2
    expect(getByText('Galicia')).toBeTruthy(); // m3
  });

  it('renders the join card and fires onPressJoin when pressed', () => {
    const { getByText, onPressJoin } = setup();
    fireEvent.press(getByText('Unirse a otro pueblo'));
    expect(onPressJoin).toHaveBeenCalled();
  });

  it('fires onPressVillage with the municipalityId when a card is pressed', () => {
    const { getByText, onPressVillage } = setup();
    fireEvent.press(getByText('Pueblo Dos'));
    expect(onPressVillage).toHaveBeenCalledWith('m2');
  });

  it('empty state still shows the join card and the empty label', () => {
    const { getByText } = setup({ villages: [] });
    expect(getByText('Unirse a otro pueblo')).toBeTruthy();
    expect(getByText('Aún no perteneces a ningún pueblo')).toBeTruthy();
  });
});
