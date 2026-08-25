import { render, fireEvent } from '@testing-library/react-native';
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
