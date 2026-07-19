import { fireEvent, render } from '@testing-library/react-native';
import { BuriedSheet } from '../BuriedSheet';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const personas = [
  { id: 'p1', name: 'Abuelo Juan', buriedHere: false },
  { id: 'p2', name: 'Tía María', buriedHere: true },
];

describe('BuriedSheet', () => {
  it('lists personas and advances to the date phase on pick, then confirms with no date', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByTestId('buried-persona-p1'));
    fireEvent.press(getByTestId('buried-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('p1', null);
  });

  it('does not confirm a persona already buried here (row disabled)', () => {
    const onConfirm = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByTestId('buried-persona-p2'));
    // Still on pick phase — no date confirm button rendered.
    expect(queryByTestId('buried-confirm')).toBeNull();
  });

  it('fires onCreateNew from the dashed row', () => {
    const onCreateNew = jest.fn();
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={onCreateNew}
        onConfirm={() => {}}
      />,
    );
    fireEvent.press(getByTestId('buried-create'));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('auto-advances to the date phase for autoSelectId', () => {
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={[{ id: 'p3', name: 'Nuevo', buriedHere: false }]}
        busy={false}
        autoSelectId="p3"
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(getByTestId('buried-confirm')).toBeTruthy();
  });
});
