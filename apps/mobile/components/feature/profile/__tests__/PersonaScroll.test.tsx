import { render } from '@testing-library/react-native';
import { PersonaScroll } from '../PersonaScroll';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const persona = {
  id: 'p1',
  givenName: 'Juan',
  middleNames: ['Carlos'],
  firstSurname: 'García',
  secondSurname: 'López',
  nickname: 'Juanito',
} as unknown as Parameters<typeof PersonaScroll>[0]['personas'][number];

describe('<PersonaScroll>', () => {
  it('shows a persona full name and never their apodo', () => {
    const { getByText, queryByText } = render(
      <PersonaScroll personas={[persona]} emptyLabel="empty" onPressPersona={jest.fn()} showAdd={false} />,
    );

    getByText('Juan Carlos García López');
    expect(queryByText(/Juanito/)).toBeNull();
  });
});
