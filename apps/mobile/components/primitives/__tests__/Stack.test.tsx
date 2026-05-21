import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HStack } from '../HStack';
import { VStack } from '../VStack';

describe('<HStack>', () => {
  it('renders children row-wise', () => {
    const { getByTestId } = render(
      <HStack testID="row" gap={4}><Text>a</Text><Text>b</Text></HStack>
    );
    expect(getByTestId('row').props.className).toMatch(/flex-row/);
    expect(getByTestId('row').props.className).toMatch(/gap-4/);
  });

  it('applies align and justify', () => {
    const { getByTestId } = render(
      <HStack testID="row2" align="center" justify="between">
        <Text>a</Text>
      </HStack>
    );
    expect(getByTestId('row2').props.className).toMatch(/items-center/);
    expect(getByTestId('row2').props.className).toMatch(/justify-between/);
  });
});

describe('<VStack>', () => {
  it('renders children column-wise', () => {
    const { getByTestId } = render(
      <VStack testID="col" gap={2}><Text>a</Text></VStack>
    );
    expect(getByTestId('col').props.className).toMatch(/flex-col/);
    expect(getByTestId('col').props.className).toMatch(/gap-2/);
  });

  it('applies align', () => {
    const { getByTestId } = render(
      <VStack testID="col2" align="center"><Text>a</Text></VStack>
    );
    expect(getByTestId('col2').props.className).toMatch(/items-center/);
  });
});
