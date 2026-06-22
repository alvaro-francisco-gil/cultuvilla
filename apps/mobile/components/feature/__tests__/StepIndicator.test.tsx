// apps/mobile/components/feature/__tests__/StepIndicator.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { StepIndicator } from '../StepIndicator';

describe('<StepIndicator>', () => {
  it('renders one dot per step', () => {
    const { getByTestId } = render(
      <StepIndicator count={3} current={0} highestReached={0} onStepPress={() => {}} />,
    );
    expect(getByTestId('step-dot-0')).toBeTruthy();
    expect(getByTestId('step-dot-1')).toBeTruthy();
    expect(getByTestId('step-dot-2')).toBeTruthy();
  });

  it('navigates to a reached step on press', () => {
    const onStepPress = jest.fn();
    const { getByTestId } = render(
      <StepIndicator count={3} current={2} highestReached={2} onStepPress={onStepPress} />,
    );
    fireEvent.press(getByTestId('step-dot-0'));
    expect(onStepPress).toHaveBeenCalledWith(0);
  });

  it('ignores presses on locked (not-yet-reached) steps', () => {
    const onStepPress = jest.fn();
    const { getByTestId } = render(
      <StepIndicator count={3} current={0} highestReached={0} onStepPress={onStepPress} />,
    );
    fireEvent.press(getByTestId('step-dot-2'));
    expect(onStepPress).not.toHaveBeenCalled();
  });
});
