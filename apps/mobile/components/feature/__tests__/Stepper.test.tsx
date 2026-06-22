// apps/mobile/components/feature/__tests__/Stepper.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Stepper, type StepConfig } from '../Stepper';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

function makeSteps(overrides: Partial<StepConfig>[] = []): StepConfig[] {
  const base: StepConfig[] = [
    { key: 'a', title: 'Step A', render: () => <Text>content-a</Text> },
    { key: 'b', title: 'Step B', render: () => <Text>content-b</Text> },
  ];
  return base.map((s, i) => ({ ...s, ...overrides[i] }));
}

describe('<Stepper>', () => {
  it('renders the first step and its title', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    expect(getByText('Step A')).toBeTruthy();
    expect(getByText('content-a')).toBeTruthy();
  });

  it('advances to the next step when the current step is valid', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('content-b')).toBeTruthy();
  });

  it('blocks advancing while the current step is invalid', () => {
    const steps = makeSteps([{ validate: () => ['err'] }]);
    const { getByText, queryByText } = render(
      <Stepper steps={steps} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByText('content-b')).toBeNull();
  });

  it('goes back without validating', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByText('common.stepper.back'));
    expect(getByText('content-a')).toBeTruthy();
  });

  it('calls onComplete from the last step', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={onComplete} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByText('Crear'));
    expect(onComplete).toHaveBeenCalled();
  });
});
