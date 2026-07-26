// Handler test for the sendAuthOtpCode callable. Firestore runs against the
// real emulator (rate-limit doc + authOtpCodes doc); only the Resend secret
// and the `resend` package itself are mocked so no network send happens.

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import functionsTestFactory from 'firebase-functions-test';
import { getFirestore } from 'firebase-admin/firestore';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { bucketIdFor } from '../../auth/rateLimit';

vi.mock('../../auth/secret', () => ({ RESEND_API_KEY: { value: () => 'TEST_RESEND_KEY' } }));

interface SendCallArgs {
  to: string;
  html: string;
  text: string;
}

const sendMock = vi.fn((_args: SendCallArgs) =>
  Promise.resolve({ data: { id: 'test-email-id' }, error: null }),
);

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock(this: { emails: { send: typeof sendMock } }) {
    this.emails = { send: sendMock };
  }),
}));

import { sendAuthOtpCode } from '../../auth/sendAuthOtpCode';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

interface CallableResult {
  ok: true;
}

async function callSend(data: unknown): Promise<CallableResult> {
  const wrapped = ft.wrap(sendAuthOtpCode as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data,
    auth: undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('sendAuthOtpCode (callable)', () => {
  beforeAll(async () => {
    await resetEmulators();
  });
  beforeEach(async () => {
    await resetEmulators();
    sendMock.mockClear();
  });
  afterAll(() => {
    ft.cleanup();
  });

  it('sends a 6-digit code and stores its hash', async () => {
    const result = await callSend({ email: 'alice@example.com' });
    expect(result.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe('alice@example.com');
    const codeMatch = call.text.match(/Tu código de acceso: (\d{6})/);
    expect(codeMatch).not.toBeNull();

    const bucketId = bucketIdFor('alice@example.com');
    const doc = await getFirestore().collection('authOtpCodes').doc(bucketId).get();
    expect(doc.exists).toBe(true);
    const data = doc.data() as { codeHash: string; attempts: number };
    expect(data.attempts).toBe(0);
    expect(data.codeHash).not.toBe(codeMatch?.[1]);
  });

  it('throws invalid-argument for a malformed email', async () => {
    await expect(callSend({ email: 'not-an-email' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rate-limits after 5 sends in the window, returning the same {ok:true} shape', async () => {
    const data = { email: 'bob@example.com' };
    for (let i = 0; i < 5; i += 1) {
      const result = await callSend(data);
      expect(result.ok).toBe(true);
    }
    expect(sendMock).toHaveBeenCalledTimes(5);

    const sixth = await callSend(data);
    expect(sixth.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(5);
  });

  it('overwrites a prior pending code for the same email', async () => {
    await callSend({ email: 'carol@example.com' });
    const firstCode = sendMock.mock.calls[0][0].text.match(/Tu código de acceso: (\d{6})/)?.[1];
    await callSend({ email: 'carol@example.com' });
    const secondCode = sendMock.mock.calls[1][0].text.match(/Tu código de acceso: (\d{6})/)?.[1];

    const bucketId = bucketIdFor('carol@example.com');
    const doc = await getFirestore().collection('authOtpCodes').doc(bucketId).get();
    const data = doc.data() as { codeHash: string };
    const { createHash } = await import('crypto');
    expect(data.codeHash).toBe(createHash('sha256').update(secondCode ?? '').digest('hex'));
    expect(data.codeHash).not.toBe(createHash('sha256').update(firstCode ?? '').digest('hex'));
  });
});
