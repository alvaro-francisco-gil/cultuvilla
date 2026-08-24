import { render, fireEvent } from '@testing-library/react-native';
import { DetailInfoCard } from '../DetailInfoCard';

describe('DetailInfoCard', () => {
  it('renders label + single-line value and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <DetailInfoCard icon="calendar-outline" label="Fecha" value="2 de Julio · 20:00" onPress={onPress} />,
    );
    getByText('Fecha');
    fireEvent.press(getByText('2 de Julio · 20:00'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Regression: the card used to carry `h-full`. On web height:100% against an
  // auto-height parent collapses to content height, but under Yoga on native it
  // resolves against the ScrollView viewport — so each card grew screen-tall and
  // pushed the event detail's description/village sections out of the scroll
  // extent. Equal heights come from the parent row's items-stretch instead.
  it('declares no percentage height (breaks native layout)', () => {
    const { toJSON } = render(
      <DetailInfoCard icon="calendar-outline" label="Fecha" value="2 de Julio" onPress={() => {}} />,
    );
    const classNames: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const n = node as { props?: Record<string, unknown>; children?: unknown };
      const cn = n.props?.['className'];
      if (typeof cn === 'string') classNames.push(cn);
      walk(n.children);
    };
    walk(toJSON());
    expect(classNames.join(' ')).not.toMatch(/\bh-full\b/);
  });
});
