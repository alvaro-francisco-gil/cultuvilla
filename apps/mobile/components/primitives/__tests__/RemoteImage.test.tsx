import { render, act } from '@testing-library/react-native';
import { RemoteImage } from '../RemoteImage';

// expo-image is a native module. Stand in RN's View, which simply records the
// props it was given so the variant/caching contract can be asserted. The
// factory must not create elements itself — NativeWind's babel plugin rewrites
// createElement/JSX and jest rejects the out-of-scope reference that injects.
jest.mock('expo-image', () => ({ Image: require('react-native').View }));

const BUCKET = 'villa-events.firebasestorage.app';
const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const url = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
    path,
  )}?alt=media&token=${TOKEN}`;

const ORIGINAL = url('municipalities/28013/events/e1/image/abc.jpg');
const CARD = url('municipalities/28013/events/e1/image/abc_card.webp');

function sourceUri(tree: ReturnType<typeof render>): string {
  const props = tree.getByTestId('expo-image').props as { source: { uri: string } };
  return props.source.uri;
}

describe('RemoteImage', () => {
  it('requests the card variant, not the original', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    expect(sourceUri(tree)).toBe(CARD);
  });

  it('requests the thumb variant when asked', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="thumb" testID="expo-image" />);
    expect(sourceUri(tree)).toContain('abc_thumb.webp');
  });

  it('requests the original when variant is "original"', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="original" testID="expo-image" />);
    expect(sourceUri(tree)).toBe(ORIGINAL);
  });

  it('caches to memory and disk', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    const props = tree.getByTestId('expo-image').props as { cachePolicy: string };
    expect(props.cachePolicy).toBe('memory-disk');
  });

  it('keys recycling to the resolved uri so list rows do not show a stale image', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    const props = tree.getByTestId('expo-image').props as { recyclingKey: string };
    expect(props.recyclingKey).toBe(CARD);
  });

  it('falls back to the original when the variant has not been generated yet', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    expect(sourceUri(tree)).toBe(CARD);

    const props = tree.getByTestId('expo-image').props as { onError: () => void };
    act(() => { props.onError(); });

    expect(sourceUri(tree)).toBe(ORIGINAL);
  });

  it('does not loop when the original itself fails', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    const fail = () => {
      const props = tree.getByTestId('expo-image').props as { onError: () => void };
      act(() => { props.onError(); });
    };
    fail();
    fail();
    expect(sourceUri(tree)).toBe(ORIGINAL);
  });

  it('retries the variant after the uri changes', () => {
    const tree = render(<RemoteImage uri={ORIGINAL} variant="card" testID="expo-image" />);
    act(() => {
      (tree.getByTestId('expo-image').props as { onError: () => void }).onError();
    });
    expect(sourceUri(tree)).toBe(ORIGINAL);

    const other = url('municipalities/28013/events/e2/image/zzz.jpg');
    tree.rerender(<RemoteImage uri={other} variant="card" testID="expo-image" />);
    expect(sourceUri(tree)).toContain('zzz_card.webp');
  });

  it('reports the natural size from the load event, with no extra network probe', () => {
    const onNaturalSize = jest.fn();
    const tree = render(
      <RemoteImage uri={ORIGINAL} variant="card" onNaturalSize={onNaturalSize} testID="expo-image" />,
    );
    const props = tree.getByTestId('expo-image').props as {
      onLoad: (e: { source: { width: number; height: number } }) => void;
    };
    act(() => { props.onLoad({ source: { width: 1600, height: 1200 } }); });

    expect(onNaturalSize).toHaveBeenCalledWith(1600, 1200);
  });

  it('ignores a degenerate natural size', () => {
    const onNaturalSize = jest.fn();
    const tree = render(
      <RemoteImage uri={ORIGINAL} variant="card" onNaturalSize={onNaturalSize} testID="expo-image" />,
    );
    const props = tree.getByTestId('expo-image').props as {
      onLoad: (e: { source: { width: number; height: number } }) => void;
    };
    act(() => { props.onLoad({ source: { width: 0, height: 0 } }); });

    expect(onNaturalSize).not.toHaveBeenCalled();
  });

  it('leaves a non-Storage uri untouched', () => {
    const external = 'https://example.test/photo.png';
    const tree = render(<RemoteImage uri={external} variant="card" testID="expo-image" />);
    expect(sourceUri(tree)).toBe(external);
  });
});
