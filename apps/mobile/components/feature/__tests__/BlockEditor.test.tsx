import { render, fireEvent } from '@testing-library/react-native';
import { BlockEditor, type EditorBlock } from '../BlockEditor';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

describe('BlockEditor', () => {
  it('merges links across a removed image, rebasing the trailing block offsets', () => {
    const blocks: EditorBlock[] = [
      {
        id: 't1',
        type: 'text',
        text: 'antes',
        mentions: [],
        links: [{ url: 'https://a.com', offset: 0, length: 5 }],
        marks: [{ type: 'bold', offset: 0, length: 5 }],
      },
      {
        id: 'i1',
        type: 'image',
        storagePath: 'p/1',
        blob: null,
        uri: null,
        width: 10,
        height: 10,
        caption: '',
        captionMentions: [],
        captionLinks: [],
        captionMarks: [],
      },
      {
        id: 't2',
        type: 'text',
        text: 'después',
        mentions: [],
        links: [{ url: 'https://b.com', offset: 0, length: 7 }],
        marks: [{ type: 'italic', offset: 0, length: 7 }],
      },
    ];
    const onChange = jest.fn();
    const { getByLabelText } = render(<BlockEditor blocks={blocks} onChange={onChange} candidates={[]} />);
    fireEvent.press(getByLabelText('news.compose.block.removeImage'));
    const merged = onChange.mock.calls.at(-1)![0][0];
    expect(merged.text).toBe('antes\n\ndespués');
    expect(merged.links).toEqual([
      { url: 'https://a.com', offset: 0, length: 5 },
      { url: 'https://b.com', offset: 7, length: 7 }, // shifted by "antes\n\n"
    ]);
    expect(merged.marks).toEqual([
      { type: 'bold', offset: 0, length: 5 },
      { type: 'italic', offset: 7, length: 7 }, // shifted by "antes\n\n"
    ]);
  });
});
