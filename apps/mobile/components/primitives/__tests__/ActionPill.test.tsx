import { render, fireEvent } from '@testing-library/react-native';
import { ActionPill } from '../ActionPill';

const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 32 } } });

/**
 * Renders a pill, reports the given pill width and unconstrained label width,
 * and returns the visible label node (index 0; index 1 is the off-screen
 * measuring copy) as it stands after both measurements.
 */
function measured(label: string, pillWidth: number, naturalWidth: number) {
  const view = render(<ActionPill label={label} onPress={jest.fn()} testID="p" />);
  // includeHiddenElements: the measuring copy is hidden from accessibility.
  const at = (i: number) => {
    const node = view.getAllByText(label, { includeHiddenElements: true })[i];
    if (!node) throw new Error(`no label node at ${i}`);
    return node;
  };
  fireEvent(view.getByTestId('p'), 'layout', layout(pillWidth));
  fireEvent(at(1), 'layout', layout(naturalWidth));
  return at(0);
}

describe('<ActionPill>', () => {
  it('presses', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<ActionPill label="Unirme" onPress={onPress} testID="p" />);
    fireEvent.press(getByTestId('p'));
    expect(onPress).toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ActionPill label="Unirme" onPress={onPress} disabled testID="p" />,
    );
    fireEvent.press(getByTestId('p'));
    expect(onPress).not.toHaveBeenCalled();
  });

  // The three assertions below are the actual bug: a long label used to wrap
  // onto a second line. It must shrink instead, and must never ellipsize.
  it('keeps the base size when the label fits', () => {
    const visible = measured('Compartir', 200, 100); // 176 usable
    expect(visible.props.style).toMatchObject({ fontSize: 16 });
    expect(visible.props.numberOfLines).toBe(1);
  });

  it('shrinks the label to keep it on one line', () => {
    const visible = measured('Añadir contenido', 124, 125); // 100 usable, needs 80%
    expect(visible.props.style).toMatchObject({ fontSize: 16 * 0.8 });
    expect(visible.props.numberOfLines).toBe(1);
  });

  it('wraps rather than ellipsizing when even the smallest size overflows', () => {
    const visible = measured('Configurar censo', 124, 400); // way past the floor
    expect(visible.props.style).toMatchObject({ fontSize: 12 });
    expect(visible.props.numberOfLines).toBeUndefined();
    expect(visible.props.ellipsizeMode).toBeUndefined();
  });

  // A 200% system font on a 3-up action row leaves nothing to shrink into.
  it('caps OS font scaling', () => {
    const { getAllByText } = render(<ActionPill label="Unirme" onPress={jest.fn()} testID="p" />);
    expect(getAllByText('Unirme')[0]?.props.maxFontSizeMultiplier).toBe(1.3);
  });
});
