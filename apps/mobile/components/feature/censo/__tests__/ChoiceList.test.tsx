import { render, fireEvent } from '@testing-library/react-native';
import { ChoiceList } from '../ChoiceList';

const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

it('single mode emits the chosen value', () => {
  const onChange = jest.fn();
  const { getByText } = render(<ChoiceList options={opts} mode="single" value={undefined} onChange={onChange} />);
  fireEvent.press(getByText('A'));
  expect(onChange).toHaveBeenCalledWith('a');
});

it('multi mode toggles values in an array', () => {
  const onChange = jest.fn();
  const { getByText } = render(<ChoiceList options={opts} mode="multi" value={['a']} onChange={onChange} />);
  fireEvent.press(getByText('B'));
  expect(onChange).toHaveBeenCalledWith(['a', 'b']);
});
