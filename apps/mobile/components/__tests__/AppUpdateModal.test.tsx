import { render, fireEvent } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { AppUpdateModal } from '../AppUpdateModal';

it('renders only the primary action when no dismiss handler is given', () => {
  const onUpdate = jest.fn();
  const { getByText, queryByTestId } = render(
    <AppUpdateModal
      visible
      title="Title"
      body="Body"
      ctaLabel="Update"
      onUpdate={onUpdate}
    />,
  );
  expect(getByText('Title')).toBeTruthy();
  expect(queryByTestId('app-update-dismiss')).toBeNull();
  fireEvent.press(getByText('Update'));
  expect(onUpdate).toHaveBeenCalled();
});

it('renders a dismiss action when a handler is given', () => {
  const onDismiss = jest.fn();
  const { getByText } = render(
    <AppUpdateModal
      visible
      title="Title"
      body="Body"
      ctaLabel="Update"
      onUpdate={jest.fn()}
      onDismiss={onDismiss}
      dismissLabel="Later"
    />,
  );
  fireEvent.press(getByText('Later'));
  expect(onDismiss).toHaveBeenCalled();
});

describe("Android's hardware back button", () => {
  const originalOS = Platform.OS;

  const setOS = (os: typeof Platform.OS) =>
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

  afterEach(() => setOS(originalOS));

  it('is swallowed while the hard block is up, and released on unmount', () => {
    setOS('android');
    const remove = jest.fn();
    const addEventListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove } as never);

    const { unmount } = render(
      <AppUpdateModal visible title="Title" body="Body" ctaLabel="Update" onUpdate={jest.fn()} />,
    );

    expect(addEventListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    // Returning true is what stops RN from dismissing/backgrounding: without it
    // the "non-dismissible" block has an escape hatch on Android.
    const handler = addEventListener.mock.calls[0]?.[1] as (() => boolean) | undefined;
    expect(handler?.()).toBe(true);

    unmount();
    expect(remove).toHaveBeenCalled();
    addEventListener.mockRestore();
  });

  it('is left alone for the soft prompt, which is meant to be dismissible', () => {
    setOS('android');
    const addEventListener = jest.spyOn(BackHandler, 'addEventListener');

    render(
      <AppUpdateModal
        visible
        title="Title"
        body="Body"
        ctaLabel="Update"
        onUpdate={jest.fn()}
        onDismiss={jest.fn()}
        dismissLabel="Later"
      />,
    );

    expect(addEventListener).not.toHaveBeenCalled();
    addEventListener.mockRestore();
  });
});
