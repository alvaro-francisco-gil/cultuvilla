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
        bolds={[]}
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

describe('MentionTextInput format toolbar', () => {
  it('bolds the selected range when the B button is pressed', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <MentionTextInput
        value="hola mundo"
        mentions={[]}
        links={[]}
        bolds={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={onChange}
      />,
    );
    fireEvent(getByPlaceholderText('Escribe…'), 'selectionChange', {
      nativeEvent: { selection: { start: 5, end: 10 } }, // "mundo"
    });
    fireEvent.press(getByLabelText('news.compose.format.bold'));

    const [, , , bolds] = onChange.mock.calls.at(-1)!;
    expect(bolds).toEqual([{ offset: 5, length: 5 }]);
  });

  it('records a link over the selection after entering a URL', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <MentionTextInput
        value="ver aquí"
        mentions={[]}
        links={[]}
        bolds={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={onChange}
      />,
    );
    fireEvent(getByPlaceholderText('Escribe…'), 'selectionChange', {
      nativeEvent: { selection: { start: 4, end: 8 } }, // "aquí"
    });
    fireEvent.press(getByLabelText('news.compose.format.link'));
    fireEvent.changeText(getByPlaceholderText('news.linkSheet.urlPlaceholder'), 'https://x.com');
    fireEvent.press(getByText('news.linkSheet.save'));

    const [text, , links] = onChange.mock.calls.at(-1)!;
    expect(text).toBe('ver aquí'); // text unchanged — a span is recorded over existing text
    expect(links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
});
