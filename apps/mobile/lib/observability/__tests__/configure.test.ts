const mockConfigureObservability = jest.fn();
const mockSetConsent = jest.fn();
const mockTrackEvent = jest.fn();
const mockSendClientError = jest.fn().mockResolvedValue(undefined);
const mockAttachGlobalHandlers = jest.fn();

jest.mock('@cultuvilla/shared', () => ({
  configureObservability: (...a: unknown[]) => mockConfigureObservability(...a),
  observability: { setConsent: (...a: unknown[]) => mockSetConsent(...a) },
  OBSERVABILITY_EVENTS: { APP_EXCEPTION: 'app.exception.thrown' },
}));
jest.mock('../analytics', () => ({
  createAnalyticsBackend: () => ({
    trackEvent: mockTrackEvent,
    setConsent: jest.fn(),
    setUserId: jest.fn(),
  }),
}));
jest.mock('../errorBridge', () => ({
  sendClientError: (...a: unknown[]) => mockSendClientError(...a),
  fetchUserIdHash: jest.fn(),
}));
jest.mock('../globalHandlers', () => ({
  attachGlobalHandlers: () => mockAttachGlobalHandlers(),
}));
jest.mock('../currentRoute', () => ({ getCurrentRoute: () => '/village/abc' }));
jest.mock('../../appVersion', () => ({ getRunningVersion: () => '0.19.0' }));

import { bootstrapObservability } from '../configure';

describe('bootstrapObservability', () => {
  it('configures the port and attaches handlers, and captureError double-writes', () => {
    bootstrapObservability();
    expect(mockConfigureObservability).toHaveBeenCalledTimes(1);
    // Analytics consent is granted implicitly via T&C acceptance, not a prompt.
    expect(mockSetConsent).toHaveBeenCalledWith({ analytics: true });
    expect(mockAttachGlobalHandlers).toHaveBeenCalledTimes(1);
    const adapter = mockConfigureObservability.mock.calls[0][0];
    adapter.captureError(new Error('boom'), { route: '/x' });
    expect(mockSendClientError).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('app.exception.thrown', expect.any(Object), null);
  });

  // A Firestore denial's message is identical whichever rule refused it, so the
  // code, the route and the running version are what make one triageable.
  it('enriches the payload with the error code, route and app version', () => {
    mockSendClientError.mockClear();
    bootstrapObservability();
    const adapter = mockConfigureObservability.mock.calls[0][0];
    const err = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    adapter.captureError(err, { operation: 'profile:getPersonsByCreator' });
    const payload = mockSendClientError.mock.calls[0][0];
    expect(payload.code).toBe('permission-denied');
    expect(payload.route).toBe('/village/abc');
    expect(payload.appVersion).toBe('0.19.0');
    expect(payload.operation).toBe('profile:getPersonsByCreator');
  });

  it('lets an explicit context value win over the default', () => {
    mockSendClientError.mockClear();
    bootstrapObservability();
    const adapter = mockConfigureObservability.mock.calls[0][0];
    adapter.captureError(new Error('boom'), { route: '/explicit' });
    expect(mockSendClientError.mock.calls[0][0].route).toBe('/explicit');
  });
});
