import { render, fireEvent } from '@testing-library/react-native';
import { VillagesScroll, type VillageRow } from '../VillagesScroll';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));

const BADGES = { active: 'Activo', admin: 'Administrador', member: 'Miembro' };

const ROWS: VillageRow[] = [
  { municipalityId: 'm1', name: 'Pueblo Uno', escudoThumbUrl: null, role: 'user' },
  { municipalityId: 'm2', name: 'Pueblo Dos', escudoThumbUrl: null, role: 'admin' },
  { municipalityId: 'm3', name: 'Pueblo Tres', escudoThumbUrl: null, role: 'user' },
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
      badges={BADGES}
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

  it('shows the active badge on the active village and the role badge otherwise', () => {
    const { getByText } = setup();
    expect(getByText('Activo')).toBeTruthy(); // m1 is active
    expect(getByText('Administrador')).toBeTruthy(); // m2 is admin, not active
    expect(getByText('Miembro')).toBeTruthy(); // m3 is user, not active
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
