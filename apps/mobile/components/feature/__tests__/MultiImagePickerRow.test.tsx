import { render, fireEvent } from '@testing-library/react-native';
import { MultiImagePickerRow } from '../MultiImagePickerRow';

describe('<MultiImagePickerRow>', () => {
  it('calls onRemove with the tapped thumbnail index', () => {
    const onRemove = jest.fn();
    const { getAllByLabelText } = render(
      <MultiImagePickerRow
        uris={['a', 'b', 'c']}
        onAddPress={() => {}}
        onRemove={onRemove}
        addLabel="add"
        removeLabel="remove"
      />,
    );
    const removeButtons = getAllByLabelText('remove');
    fireEvent.press(removeButtons[1]!);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('hides the "+" add tile once `max` images are already picked', () => {
    const { queryByLabelText } = render(
      <MultiImagePickerRow
        uris={['a', 'b', 'c', 'd', 'e']}
        onAddPress={() => {}}
        onRemove={() => {}}
        max={5}
        addLabel="add"
        removeLabel="remove"
      />,
    );
    expect(queryByLabelText('add')).toBeNull();
  });

  it('shows the "+" add tile under the cap', () => {
    const { queryByLabelText } = render(
      <MultiImagePickerRow
        uris={['a']}
        onAddPress={() => {}}
        onRemove={() => {}}
        max={5}
        addLabel="add"
        removeLabel="remove"
      />,
    );
    expect(queryByLabelText('add')).not.toBeNull();
  });
});
