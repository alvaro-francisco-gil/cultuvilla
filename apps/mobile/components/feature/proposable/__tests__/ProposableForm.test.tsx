import { render } from '@testing-library/react-native';
import { ProposableForm } from '../ProposableForm';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));

describe('ProposableForm images', () => {
  it('renders one thumbnail per already-uploaded image URL', () => {
    const { UNSAFE_getAllByProps } = render(
      <ProposableForm
        images={['https://example.com/escudo.png']}
        onAddImage={() => {}}
        onRemoveImage={() => {}}
        imageLabels={{ add: 'add', remove: 'remove' }}
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

  it('hides the "+" add tile once the image cap (5) is reached', () => {
    const { queryByLabelText } = render(
      <ProposableForm
        images={['a', 'b', 'c', 'd', 'e']}
        onAddImage={() => {}}
        onRemoveImage={() => {}}
        imageLabels={{ add: 'add-photo', remove: 'remove-photo' }}
        name="Peña"
        onChangeName={() => {}}
        nameLabel="name"
        submitLabel="save"
        onSubmit={() => {}}
        saving={false}
        disabled={false}
      />,
    );
    expect(queryByLabelText('add-photo')).toBeNull();
  });
});

describe('ProposableForm submit button', () => {
  it('omits the submit button when hideSubmit is set', () => {
    const { queryByText } = render(
      <ProposableForm
        images={[]}
        onAddImage={() => {}}
        onRemoveImage={() => {}}
        name="Peña"
        onChangeName={() => {}}
        nameLabel="name"
        submitLabel="save"
        onSubmit={() => {}}
        saving={false}
        disabled={false}
        hideSubmit
      />,
    );
    expect(queryByText('save')).toBeNull();
  });
});
