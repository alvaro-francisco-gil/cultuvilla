import { render, fireEvent } from '@testing-library/react-native';
import { MentionTextInput } from '../MentionTextInput';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const noopCandidates: never[] = [];

describe('MentionTextInput link paste', () => {
  it('opens the link sheet when a URL is pasted and stores a custom-text link on save', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <MentionTextInput
        value="ver "
        mentions={[]}
        links={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={onChange}
      />,
    );
    // Simulate a paste: the value jumps by a multi-char URL chunk.
    fireEvent.changeText(getByPlaceholderText('Escribe…'), 'ver https://x.com');
    // Sheet appears; type display text and save.
    fireEvent.changeText(getByPlaceholderText('news.linkSheet.textPlaceholder'), 'aquí');
    fireEvent.press(getByText('news.linkSheet.save'));

    const [text, , links] = onChange.mock.calls.at(-1)!;
    expect(text).toBe('ver aquí');
    expect(links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
});
