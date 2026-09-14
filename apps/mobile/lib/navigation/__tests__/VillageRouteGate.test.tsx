import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { resolveVillageSlug } from '@cultuvilla/shared/services/municipalityService';
import { VillageRouteGate, useVillageRoute } from '../VillageRouteGate';

const mockParams: Record<string, string> = { pueblo: 'matabuena' };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({ resolveVillageSlug: jest.fn() }));
jest.mock('../../i18n', () => ({ useT: () => ({ t: (key: string) => key }) }));

const resolve = resolveVillageSlug as jest.Mock;

function Probe() {
  const { municipalityId, slug } = useVillageRoute();
  return <Text>{`${slug}:${municipalityId}`}</Text>;
}

function renderGate() {
  return render(
    <VillageRouteGate>
      <Probe />
    </VillageRouteGate>,
  );
}

describe('VillageRouteGate', () => {
  beforeEach(() => resolve.mockReset());

  it('renders the screen with the municipality behind the slug', async () => {
    resolve.mockResolvedValue('m42');
    const { findByText } = renderGate();
    expect(await findByText('matabuena:m42')).toBeTruthy();
    expect(resolve).toHaveBeenCalledWith('matabuena');
  });

  it('holds the screen back until the slug resolves', () => {
    resolve.mockReturnValue(new Promise(() => {}));
    const { queryByText } = renderGate();
    expect(queryByText(/matabuena:/)).toBeNull();
  });

  // A mistyped or unknown pueblo must say so, not spin forever or render a
  // screen with no village behind it.
  it('says the pueblo was not found when no village has the slug', async () => {
    resolve.mockResolvedValue(null);
    const { findByText, queryByText } = renderGate();
    expect(await findByText('village.notFound')).toBeTruthy();
    expect(queryByText(/matabuena:/)).toBeNull();
  });

  it('shows a retryable error when the lookup fails', async () => {
    resolve.mockRejectedValue(new Error('offline'));
    const { findByText } = renderGate();
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    expect(await findByText('common.error.retry')).toBeTruthy();
  });
});
