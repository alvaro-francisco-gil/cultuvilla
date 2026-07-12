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
});
