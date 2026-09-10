import { dismissSeoShell } from '../seoShell.web';
import { dismissSeoShell as dismissNative } from '../seoShell';

type FakeDocument = { getElementById: (id: string) => { remove: () => void } | null };
const g = globalThis as { document?: FakeDocument };

afterEach(() => {
  delete g.document;
});

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
