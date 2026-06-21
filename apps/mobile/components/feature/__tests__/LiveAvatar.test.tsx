import { render } from '@testing-library/react-native';
import { LiveAvatar } from '../LiveAvatar';
import { useFirestoreDoc } from '@cultuvilla/shared';
import { userDoc, personDoc, organizationDoc } from '@cultuvilla/shared/firebase/refs/client';

jest.mock('@cultuvilla/shared', () => ({
  getDb: jest.fn(() => ({})),
  useFirestoreDoc: jest.fn(),
}));
jest.mock('@cultuvilla/shared/firebase/refs/client', () => ({
  userDoc: jest.fn((_db, id) => ({ __ref: 'user', id })),
  personDoc: jest.fn((_db, id) => ({ __ref: 'person', id })),
  organizationDoc: jest.fn((_db, id) => ({ __ref: 'organization', id })),
}));

const mockUseFirestoreDoc = useFirestoreDoc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFirestoreDoc.mockReturnValue({ data: undefined, loading: true, error: null });
});

describe('<LiveAvatar>', () => {
  it("subscribes to the user doc and renders the owner's photoURL", () => {
    mockUseFirestoreDoc.mockReturnValue({
      data: { photoURL: 'https://img/alice.jpg' },
      loading: false,
      error: null,
    });

    const { UNSAFE_getByType } = render(<LiveAvatar ownerId="alice" ownerType="user" />);

    expect(userDoc).toHaveBeenCalledWith(expect.anything(), 'alice');
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://img/alice.jpg' });
  });

  it('reads imageURL for organization owners', () => {
    mockUseFirestoreDoc.mockReturnValue({
      data: { imageURL: 'https://img/pena.jpg' },
      loading: false,
      error: null,
    });

    const { UNSAFE_getByType } = render(<LiveAvatar ownerId="pena1" ownerType="organization" />);

    expect(organizationDoc).toHaveBeenCalledWith(expect.anything(), 'pena1');
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://img/pena.jpg' });
  });

  it('uses the person doc for person owners', () => {
    render(<LiveAvatar ownerId="p1" ownerType="person" />);
    expect(personDoc).toHaveBeenCalledWith(expect.anything(), 'p1');
  });

  it('falls back to initials when the owner has no image', () => {
    mockUseFirestoreDoc.mockReturnValue({ data: { photoURL: null }, loading: false, error: null });

    const { getByText } = render(
      <LiveAvatar ownerId="alice" ownerType="user" initials="A" />,
    );

    expect(getByText('A')).toBeTruthy();
  });

  it('does not build a ref when ownerId is missing', () => {
    render(<LiveAvatar ownerId={null} ownerType="user" initials="?" />);
    expect(userDoc).not.toHaveBeenCalled();
    // ref stays null → hook is called with null (disabled)
    expect(mockUseFirestoreDoc).toHaveBeenCalledWith(null);
  });
});
