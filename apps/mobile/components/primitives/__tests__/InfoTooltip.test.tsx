import { render, fireEvent } from '@testing-library/react-native';
import { InfoTooltip } from '../InfoTooltip';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

describe('<InfoTooltip>', () => {
  it('keeps the explanation hidden until the icon is pressed', () => {
    const { getByTestId, getByText, queryByText } = render(
      <InfoTooltip title="Grupos" text="Cuántas personas se apuntan juntas." testID="tip" />,
    );
    expect(queryByText('Cuántas personas se apuntan juntas.')).toBeNull();
    fireEvent.press(getByTestId('tip'));
    expect(getByText('Grupos')).toBeTruthy();
    expect(getByText('Cuántas personas se apuntan juntas.')).toBeTruthy();
  });

  it('closes again from the close action', () => {
    const { getByTestId, queryByText } = render(<InfoTooltip text="Ayuda" testID="tip" />);
    fireEvent.press(getByTestId('tip'));
    expect(queryByText('Ayuda')).toBeTruthy();
    fireEvent.press(getByTestId('tip-close'));
    expect(queryByText('Ayuda')).toBeNull();
  });

  // Several of these sit in one form, so the label has to name the field it
  // belongs to — three identical "Más información" buttons are unusable.
  it('names the field it explains in the icon accessibility label', () => {
    const { getByLabelText } = render(<InfoTooltip title="Grupos" text="Ayuda" />);
    expect(getByLabelText('common.moreInfo: Grupos')).toBeTruthy();
  });

  it('falls back to a bare label when there is no title', () => {
    const { getByLabelText } = render(<InfoTooltip text="Ayuda" />);
    expect(getByLabelText('common.moreInfo')).toBeTruthy();
  });
});
