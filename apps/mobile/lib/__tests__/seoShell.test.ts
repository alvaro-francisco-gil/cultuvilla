import { renderHook } from '@testing-library/react-native';
import { dismissSeoShell, useSeoShellFailsafe, SEO_SHELL_FAILSAFE_MS } from '../seoShell.web';
import { dismissSeoShell as dismissNative } from '../seoShell';

let mockPathname = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));

type FakeDocument = { getElementById: (id: string) => { remove: () => void } | null };
const g = globalThis as { document?: FakeDocument };

afterEach(() => {
  delete g.document;
  jest.useRealTimers();
});

function withBlock(): jest.Mock {
  const remove = jest.fn();
  g.document = { getElementById: (id) => (id === 'seo-content' ? { remove } : null) };
  return remove;
}

describe('dismissSeoShell (web)', () => {
  it('removes the server-rendered block that ogRenderer injected', () => {
    const remove = jest.fn();
    g.document = { getElementById: (id) => (id === 'seo-content' ? { remove } : null) };

    dismissSeoShell();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  // Most routes are never rewritten to ogRenderer, and every entity detail
  // screen calls this unconditionally once loaded — so absence is the common
  // case and must be silent.
  it('is a no-op on a route the renderer never touched', () => {
    g.document = { getElementById: () => null };
    expect(() => dismissSeoShell()).not.toThrow();
  });

  it('is a no-op without a DOM at all', () => {
    expect(() => dismissSeoShell()).not.toThrow();
  });
});

describe('dismissSeoShell (native)', () => {
  it('never touches a document — there is no server shell on iOS/Android', () => {
    const getElementById = jest.fn();
    g.document = { getElementById };
    dismissNative();
    expect(getElementById).not.toHaveBeenCalled();
  });
});

// The block is a full-viewport overlay: if nothing removes it, the app is
// unusable. These cover the paths where no self-dismissing screen ever mounts.
describe('useSeoShellFailsafe (web)', () => {
  it('leaves the block to the screen while on a share-link route', () => {
    mockPathname = '/event/e1';
    const remove = withBlock();
    renderHook(() => useSeoShellFailsafe());
    expect(remove).not.toHaveBeenCalled();
  });

  // A cold /village/{id} link redirects to the village tab, whose pathname is
  // /village — the tab's VillageHomeBody dismisses it, so the net must not.
  it('keeps the block across the cold-village redirect', () => {
    mockPathname = '/village/v1';
    const remove = withBlock();
    const { rerender } = renderHook(() => useSeoShellFailsafe());
    mockPathname = '/village';
    rerender({});
    expect(remove).not.toHaveBeenCalled();
  });

  it('drops the block the moment the root layout routes elsewhere (auth, onboarding)', () => {
    mockPathname = '/event/e1';
    const remove = withBlock();
    const { rerender } = renderHook(() => useSeoShellFailsafe());
    mockPathname = '/onboarding';
    rerender({});
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('drops the block unconditionally once the failsafe elapses', () => {
    jest.useFakeTimers();
    mockPathname = '/event/e1';
    const remove = withBlock();
    renderHook(() => useSeoShellFailsafe());
    jest.advanceTimersByTime(SEO_SHELL_FAILSAFE_MS - 1);
    expect(remove).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
