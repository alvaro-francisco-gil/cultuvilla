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
        marks={[]}
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
  it.each([
    ['bold', 'news.compose.format.bold'],
    ['italic', 'news.compose.format.italic'],
    ['underline', 'news.compose.format.underline'],
    ['strikethrough', 'news.compose.format.strikethrough'],
  ])('marks the selected range %s when its button is pressed', (type, label) => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <MentionTextInput
        value="hola mundo"
        mentions={[]}
        links={[]}
        marks={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={onChange}
      />,
    );
    fireEvent(getByPlaceholderText('Escribe…'), 'selectionChange', {
      nativeEvent: { selection: { start: 5, end: 10 } }, // "mundo"
    });
    fireEvent.press(getByLabelText(label));

    const [, , , marks] = onChange.mock.calls.at(-1)!;
    expect(marks).toEqual([{ type, offset: 5, length: 5 }]);
  });

  it('records a link over the selection after entering a URL', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <MentionTextInput
        value="ver aquí"
        mentions={[]}
        links={[]}
        marks={[]}
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

describe('MentionTextInput popup anchoring', () => {
  it('anchors the toolbar just below the measured caret line, not the field bottom', () => {
    const { getByPlaceholderText, getByTestId } = render(
      <MentionTextInput
        value="hola mundo"
        mentions={[]}
        links={[]}
        marks={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={jest.fn()}
      />,
    );
    fireEvent(getByPlaceholderText('Escribe…'), 'selectionChange', {
      nativeEvent: { selection: { start: 5, end: 10 } }, // "mundo"
    });
    // Simulate the hidden mirror text measuring 40px of wrapped text above the caret.
    fireEvent(getByTestId('caret-line-measurer'), 'layout', {
      nativeEvent: { layout: { height: 40, width: 200, x: 0, y: 0 } },
    });

    expect(getByTestId('format-toolbar').props.style).toMatchObject({ position: 'absolute', top: 46 });
  });

  it('re-anchors the link-url sheet at the same measured position', () => {
    const { getByPlaceholderText, getByTestId, getByLabelText } = render(
      <MentionTextInput
        value="ver aquí"
        mentions={[]}
        links={[]}
        marks={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={jest.fn()}
      />,
    );
    fireEvent(getByPlaceholderText('Escribe…'), 'selectionChange', {
      nativeEvent: { selection: { start: 4, end: 8 } }, // "aquí"
    });
    fireEvent(getByTestId('caret-line-measurer'), 'layout', {
      nativeEvent: { layout: { height: 12, width: 200, x: 0, y: 0 } },
    });
    fireEvent.press(getByLabelText('news.compose.format.link'));

    expect(getByTestId('link-url-sheet').props.style).toEqual({ top: 18 });
  });
});
