import { downloadFile } from '../downloadFile.web';

/**
 * The web half never runs under jest's default (native) platform resolution, so
 * it is imported by its explicit `.web` path and given a minimal DOM. Worth a
 * test of its own: it is the only export path real users have today, and a
 * regression here is invisible to every other suite in the app.
 */
const anchor = { href: '', download: '', click: jest.fn() };
const appended: unknown[] = [];
const revoked: string[] = [];
let lastBlob: { parts: unknown[]; type: string } | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  anchor.href = '';
  anchor.download = '';
  appended.length = 0;
  revoked.length = 0;
  lastBlob = null;

  Object.assign(globalThis, {
    document: {
      createElement: jest.fn(() => anchor),
      body: { appendChild: jest.fn((n: unknown) => appended.push(n)), removeChild: jest.fn() },
    },
    Blob: class {
      constructor(parts: unknown[], options: { type: string }) {
        lastBlob = { parts, type: options.type };
      }
    },
    URL: {
      createObjectURL: jest.fn(() => 'blob:fake-url'),
      revokeObjectURL: jest.fn((u: string) => revoked.push(u)),
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('downloadFile (web)', () => {
  it('clicks a named anchor at an object URL carrying the right MIME type', async () => {
    await downloadFile('Nombre;Estado\r\n', 'asistentes.csv', 'text/csv;charset=utf-8');

    expect(lastBlob).toEqual({ parts: ['Nombre;Estado\r\n'], type: 'text/csv;charset=utf-8' });
    expect(anchor.href).toBe('blob:fake-url');
    expect(anchor.download).toBe('asistentes.csv');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    // Safari ignores a click on a detached node, so the anchor must be in the
    // document at click time.
    expect(appended).toEqual([anchor]);
  });

  it('revokes the object URL, but only after the click has been handled', async () => {
    await downloadFile(new ArrayBuffer(4), 'asistentes.xlsx', 'application/xlsx');

    // Revoking synchronously cancels the download in Firefox.
    expect(revoked).toEqual([]);
    jest.runAllTimers();
    expect(revoked).toEqual(['blob:fake-url']);
  });
});
