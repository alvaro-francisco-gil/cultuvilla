import { renderHook } from '@testing-library/react-native';
import { Share } from 'react-native';
import { useShareDeepLink } from '../useShareDeepLink';
import type { DeepLink } from '@cultuvilla/shared/services/deepLinkService';

jest.mock('../../i18n', () => ({
  useT: () => ({
    t: (_key: string, vars?: Record<string, string>) =>
      `Te invito a unirte a ${vars?.name} en Cultuvilla: ${vars?.url}`,
  }),
}));

const link: DeepLink = {
  url: 'https://cultuvilla-beta.web.app/village/v1/join',
  kind: 'invite',
  resource: 'village',
  id: 'v1',
};

describe('useShareDeepLink', () => {
  it('shares the URL exactly once (no separate url field to duplicate it)', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const { result } = renderHook(() => useShareDeepLink());

    await result.current(link, 'Altozano');

    const arg = shareSpy.mock.calls[0]?.[0] as { message: string; url?: string };
    // The URL lives in the message text; passing `url` too makes the Web Share
    // API render the link twice (the reported "two links in one message" bug).
    expect(arg.url).toBeUndefined();
    expect(arg.message).toContain(link.url);
    const occurrences = arg.message.split(link.url).length - 1;
    expect(occurrences).toBe(1);
    shareSpy.mockRestore();
  });
});
