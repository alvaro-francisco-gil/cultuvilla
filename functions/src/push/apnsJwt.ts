import { createPrivateKey, sign } from 'node:crypto';

/**
 * The provider token APNs expects in `authorization: bearer …`.
 *
 * Hand-built rather than pulled from a JWT library: it is one fixed header, two
 * claims and an ES256 signature, and the one detail that matters — APNs wants
 * the raw r‖s signature (IEEE P1363), not the DER encoding node produces by
 * default — is easier to see and test here than to verify inside a dependency.
 */
export interface ApnsCredentials {
  teamId: string;
  keyId: string;
  privateKey: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function buildApnsJwt(creds: ApnsCredentials, now: Date): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: creds.keyId }));
  const claims = base64url(
    JSON.stringify({ iss: creds.teamId, iat: Math.floor(now.getTime() / 1000) }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey(creds.privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

export function parseApnsSecret(raw: string): Omit<ApnsCredentials, 'teamId'> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'keyId' in parsed &&
      'privateKey' in parsed &&
      typeof parsed.keyId === 'string' &&
      typeof parsed.privateKey === 'string' &&
      parsed.keyId.length > 0 &&
      parsed.privateKey.includes('PRIVATE KEY')
    ) {
      return { keyId: parsed.keyId, privateKey: parsed.privateKey };
    }
    return null;
  } catch {
    return null;
  }
}
