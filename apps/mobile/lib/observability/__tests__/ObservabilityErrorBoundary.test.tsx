import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ObservabilityErrorBoundary } from '../ObservabilityErrorBoundary';

const mockCaptureError = jest.fn();
jest.mock('@cultuvilla/shared', () => ({
  observability: { captureError: (...a: unknown[]) => mockCaptureError(...a) },
}));

function Boom(): React.ReactElement {
  throw new Error('render boom');
}

describe('ObservabilityErrorBoundary', () => {
  it('renders fallback and reports the error', () => {
    const { getByText } = render(
      <ObservabilityErrorBoundary fallback={<Text>algo salió mal</Text>}>
        <Boom />
      </ObservabilityErrorBoundary>,
    );
    expect(getByText('algo salió mal')).toBeTruthy();
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
  });
});
