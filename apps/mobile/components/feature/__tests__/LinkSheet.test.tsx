// apps/mobile/components/feature/__tests__/LinkSheet.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { LinkSheet } from '../LinkSheet';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

describe('LinkSheet', () => {
  it('is not rendered when url is null', () => {
    const { queryByText } = render(<LinkSheet url={null} onSave={jest.fn()} onDismiss={jest.fn()} />);
    expect(queryByText('news.linkSheet.title')).toBeNull();
  });

  it('returns the typed display text on save', () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <LinkSheet url="https://x.com" onSave={onSave} onDismiss={jest.fn()} />,
    );
    fireEvent.changeText(getByPlaceholderText('news.linkSheet.textPlaceholder'), 'aquí');
    fireEvent.press(getByText('news.linkSheet.save'));
    expect(onSave).toHaveBeenCalledWith('aquí');
  });

  it('calls onDismiss on skip', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(<LinkSheet url="https://x.com" onSave={jest.fn()} onDismiss={onDismiss} />);
    fireEvent.press(getByText('news.linkSheet.skip'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
