import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { WordOfTheDayCard } from '../WordOfTheDayCard';
import type { WordOfTheDay } from '../../../../lib/useVillageHome';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const term = (slug: string, kind = 'palabra') =>
  ({ id: `m1__${slug}`, term: slug, kind }) as unknown as WordOfTheDay['term'];

const word: WordOfTheDay = {
  term: term('ajigolado'),
  definition: {
    id: 'd1',
    definition: 'Que se queda sin aire.',
    example: 'Subí la cuesta y llegué ajigolado.',
  } as unknown as WordOfTheDay['definition'],
  more: [term('modorro'), term('miaja')],
};

beforeEach(() => jest.clearAllMocks());

describe('WordOfTheDayCard', () => {
  // The section is named after the pueblo — "Diccionario de Matabuena", not a
  // generic "Vocabulario" — so the title carries the village through.
  it('titles the section after the village', () => {
    const { getByText } = render(
      <WordOfTheDayCard word={word} count={48} villageSlug="anaya" villageName="Anaya" />,
    );
    expect(getByText('village.vocabulary.title:{"village":"Anaya"}')).toBeTruthy();
  });

  it('shows the word with its meaning and example', () => {
    const { getByText } = render(
      <WordOfTheDayCard word={word} count={48} villageSlug="anaya" villageName="Anaya" />,
    );
    expect(getByText('ajigolado')).toBeTruthy();
    expect(getByText('Que se queda sin aire.')).toBeTruthy();
    expect(getByText('«Subí la cuesta y llegué ajigolado.»')).toBeTruthy();
  });

  it('still shows a word nobody has defined yet', () => {
    const { getByText } = render(
      <WordOfTheDayCard
        word={{ ...word, definition: null }}
        count={48}
        villageSlug="anaya"
        villageName="Anaya"
      />,
    );
    expect(getByText('ajigolado')).toBeTruthy();
  });

  it('opens the word, the other suggested words, and the whole vocabulary', () => {
    const { getByText } = render(
      <WordOfTheDayCard word={word} count={48} villageSlug="anaya" villageName="Anaya" />,
    );
    fireEvent.press(getByText('ajigolado'));
    expect(router.push).toHaveBeenLastCalledWith('/anaya/palabra/ajigolado');
    fireEvent.press(getByText('miaja'));
    expect(router.push).toHaveBeenLastCalledWith('/anaya/palabra/miaja');
    fireEvent.press(getByText('village.vocabulary.seeAll:{"count":48}'));
    expect(router.push).toHaveBeenLastCalledWith('/anaya/vocabulario');
  });
});
