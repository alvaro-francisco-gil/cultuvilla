import { downloadFile } from '../downloadFile';

/**
 * Stand-in for expo-file-system's `File`. Records what was written so the tests
 * can assert on the bytes rather than on the call shape.
 */
class MockCacheFile {
  readonly uri: string;
  created = false;
  deleted = false;
  written: (string | Uint8Array)[] = [];

  constructor(dir: { uri: string }, name: string) {
    this.uri = `${dir.uri}${name}`;
    mockFs.instances.push(this);
  }
  /** Whether a leftover from a previous export is already at this path. */
  get exists() {
    return mockFs.alreadyExists;
  }
  create() {
    this.created = true;
  }
  delete() {
    this.deleted = true;
  }
  write(content: string | Uint8Array) {
    this.written.push(content);
  }
}

const mockFs = { instances: [] as MockCacheFile[], alreadyExists: false };
const mockShareAsync = jest.fn<Promise<void>, [string, Record<string, unknown>?]>();
const mockIsAvailableAsync = jest.fn<Promise<boolean>, []>();

jest.mock('expo-file-system', () => ({
  // A getter, not a direct reference: jest hoists this factory above the class
  // declaration, so the binding only exists by the time a test calls into it.
  get File() {
    return MockCacheFile;
  },
  Paths: { cache: { uri: 'file:///cache/' } },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: [string, Record<string, unknown>?]) => mockShareAsync(...args),
}));

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.instances = [];
  mockFs.alreadyExists = false;
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
});

describe('downloadFile (native)', () => {
  it('writes CSV text to the cache directory and opens the share sheet', async () => {
    const csv = 'Nombre;Estado\r\nAna Pérez;Confirmado\r\n';

    await downloadFile(csv, 'asistentes.csv', 'text/csv;charset=utf-8');

    const file = mockFs.instances[0]!;
    expect(file.uri).toBe('file:///cache/asistentes.csv');
    expect(file.created).toBe(true);
    expect(file.written).toEqual([csv]);
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/asistentes.csv', {
      // The charset parameter is stripped: iOS matches on the bare type.
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'asistentes.csv',
    });
  });

  it('writes the workbook as bytes, not as a stringified ArrayBuffer', async () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]).buffer;

    await downloadFile(bytes, 'asistentes.xlsx', XLSX_MIME);

    const written = mockFs.instances[0]!.written[0];
    expect(written).toBeInstanceOf(Uint8Array);
    expect(Array.from(written as Uint8Array)).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(mockShareAsync.mock.calls[0]![1]).toMatchObject({
      mimeType: XLSX_MIME,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  });

  it('clears a previous export of the same roster instead of throwing on it', async () => {
    mockFs.alreadyExists = true;

    await downloadFile('x', 'asistentes.csv', 'text/csv');

    const file = mockFs.instances[0]!;
    expect(file.deleted).toBe(true);
    expect(file.created).toBe(true);
    expect(file.written).toEqual(['x']);
  });

  it('fails loudly when the device has no share sheet, without leaving a file behind', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(downloadFile('x', 'asistentes.csv', 'text/csv')).rejects.toThrow(/not available/i);
    expect(mockFs.instances).toHaveLength(0);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('omits the UTI for a type iOS has no mapping for rather than inventing one', async () => {
    await downloadFile('x', 'roster.txt', 'text/plain');

    expect(mockShareAsync.mock.calls[0]![1]).toMatchObject({ mimeType: 'text/plain', UTI: undefined });
  });
});
