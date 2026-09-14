import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { HistoryRail } from '../HistoryRail';
import { historyEntryHref } from '../../../../lib/navigation/routes';
import type { HistoryEntryWithId } from '@cultuvilla/shared/services/historyService';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const entry = (id: string, year: number, title: string, extra: Partial<HistoryEntryWithId> = {}) =>
  ({
    id,
    title,
    start: { year, month: null, day: null },
    end: null,
    approximate: false,
    body: { text: `Relato de ${title}`, mentions: [], links: [], marks: [] },
    images: [],
    ...extra,
  }) as unknown as HistoryEntryWithId;

const entries = [
  entry('h1', 1136, 'Primera mención escrita'),
  entry('h2', 1558, 'Se levanta la torre', { approximate: true }),
];

beforeEach(() => jest.clearAllMocks());

describe('HistoryRail', () => {
  it('renders nothing when the village has no history yet', () => {
    const { toJSON } = render(<HistoryRail entries={[]} villageSlug="anaya" />);
    expect(toJSON()).toBeNull();
  });

  it('labels each event with its year on the rail', () => {
    const { getByText } = render(<HistoryRail entries={entries} villageSlug="anaya" />);
    expect(getByText('1136')).toBeTruthy();
    expect(getByText('h. 1558')).toBeTruthy();
    expect(getByText('Primera mención escrita')).toBeTruthy();
  });

  it('opens an event, and the whole timeline from "Ver todo"', () => {
    const { getByText } = render(<HistoryRail entries={entries} villageSlug="anaya" />);
    fireEvent.press(getByText('Se levanta la torre'));
    expect(router.push).toHaveBeenCalledWith(
      historyEntryHref({ id: 'h2', title: 'Se levanta la torre', villageSlug: 'anaya' }),
    );
    fireEvent.press(getByText('village.home.seeAll'));
    expect(router.push).toHaveBeenCalledWith('/anaya/historia');
  });
});
