import { render, fireEvent } from '@testing-library/react-native';
import { VillageContentManager } from '../VillageContentManager';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));
jest.mock('../PlacesManager', () => ({
  PlacesManager: () =>
    require('react').createElement(require('react-native').Text, null, 'places-manager'),
}));
jest.mock('../BarriosManager', () => ({
  BarriosManager: () =>
    require('react').createElement(require('react-native').Text, null, 'barrios-manager'),
}));
jest.mock('../OrganizationsManager', () => ({
  OrganizationsManager: () =>
    require('react').createElement(require('react-native').Text, null, 'organizations-manager'),
}));
jest.mock('../FestivalPostersManager', () => ({
  FestivalPostersManager: () =>
    require('react').createElement(require('react-native').Text, null, 'festival-posters-manager'),
}));

describe('<VillageContentManager>', () => {
  it('has no "Todos" chip', () => {
    const { queryByTestId } = render(<VillageContentManager villageId="m1" />);
    expect(queryByTestId('filter-chip-all')).toBeNull();
  });

  it('shows every section by default', () => {
    const { getByText } = render(<VillageContentManager villageId="m1" />);
    expect(getByText('places-manager')).toBeTruthy();
    expect(getByText('barrios-manager')).toBeTruthy();
    expect(getByText('organizations-manager')).toBeTruthy();
    expect(getByText('festival-posters-manager')).toBeTruthy();
  });

  it('hides a section when its chip is unselected, and restores it when re-selected', () => {
    const { getByTestId, queryByText, getByText } = render(
      <VillageContentManager villageId="m1" />,
    );
    fireEvent.press(getByTestId('filter-chip-places'));
    expect(queryByText('places-manager')).toBeNull();
    // Other sections stay visible.
    expect(getByText('barrios-manager')).toBeTruthy();

    fireEvent.press(getByTestId('filter-chip-places'));
    expect(getByText('places-manager')).toBeTruthy();
  });
});
