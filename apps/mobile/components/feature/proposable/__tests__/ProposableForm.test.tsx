import { render } from '@testing-library/react-native';
import { ProposableForm } from '../ProposableForm';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));

describe('ProposableForm existingImageUri', () => {
  it('renders the existing image as the picker thumbnail when no image is picked', () => {
    const { UNSAFE_getAllByProps } = render(
      <ProposableForm
        image={null}
        onImageChange={() => {}}
        existingImageUri="https://example.com/escudo.png"
        imageLabels={{ add: 'add', selected: 'selected' }}
        name="Peña"
        onChangeName={() => {}}
        nameLabel="name"
        submitLabel="save"
        onSubmit={() => {}}
        saving={false}
        disabled={false}
      />,
    );
    // ImagePickerField receives the existing URL as its `uri` prop.
    expect(
      UNSAFE_getAllByProps({ uri: 'https://example.com/escudo.png' }).length,
    ).toBeGreaterThan(0);
  });
});
