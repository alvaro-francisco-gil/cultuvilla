// apps/mobile/components/feature/__tests__/Stepper.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Stepper, classifySwipe, type StepConfig } from '../Stepper';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function makeSteps(overrides: Partial<StepConfig>[] = []): StepConfig[] {
  const base: StepConfig[] = [
    { key: 'a', title: 'Step A', render: () => <Text>content-a</Text> },
    { key: 'b', title: 'Step B', render: () => <Text>content-b</Text> },
  ];
  return base.map((s, i) => ({ ...s, ...overrides[i] }));
}

describe('<Stepper>', () => {
  it('renders the first step content', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    // Step titles are no longer shown as text (icon-only indicator); the
    // current step's content is what renders.
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

  it('lets you jump directly to any step in edit mode (allStepsReachable)', () => {
    const { getByText, getByTestId } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} allStepsReachable />,
    );
    // Tap the second step's dot without pressing Next — it navigates directly.
    fireEvent.press(getByTestId('step-dot-1'));
    expect(getByText('content-b')).toBeTruthy();
  });

  it('blocks tapping a not-yet-reached step in create mode', () => {
    const { getByTestId, queryByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByTestId('step-dot-1'));
    expect(queryByText('content-b')).toBeNull();
  });
});

describe('classifySwipe', () => {
  it('treats a clear leftward drag as forward', () => {
    expect(classifySwipe(-80, 5)).toBe('forward');
  });

  it('treats a clear rightward drag as back', () => {
    expect(classifySwipe(80, -5)).toBe('back');
  });

  it('ignores short drags below the threshold', () => {
    expect(classifySwipe(-20, 0)).toBeNull();
  });

  it('ignores vertical-dominant drags so inner scrolling still works', () => {
    expect(classifySwipe(-50, -120)).toBeNull();
  });
});
