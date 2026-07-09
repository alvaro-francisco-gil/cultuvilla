import { render } from '@testing-library/react-native';
import { NotificationRow } from './NotificationRow';

describe('<NotificationRow>', () => {
  it('renders the title and body', () => {
    const { getByText } = render(
      <NotificationRow
        title="Solicitud aprobada"
        body="Tu solicitud para organizar el pueblo ha sido aprobada."
        read={true}
        createdAt={new Date()}
      />
    );
    expect(getByText('Solicitud aprobada')).toBeTruthy();
    expect(getByText('Tu solicitud para organizar el pueblo ha sido aprobada.')).toBeTruthy();
  });

  it('shows an unread indicator when read is false', () => {
    const { getByTestId } = render(
      <NotificationRow
        title="Nueva solicitud"
        body="Alguien quiere unirse a la organización."
        read={false}
        createdAt={new Date()}
      />
    );
    expect(getByTestId('notification-unread-dot')).toBeTruthy();
  });

  it('does not show the unread indicator when read is true', () => {
    const { queryByTestId } = render(
      <NotificationRow
        title="Solicitud aprobada"
        body="Tu solicitud ha sido aprobada."
        read={true}
        createdAt={new Date()}
      />
    );
    expect(queryByTestId('notification-unread-dot')).toBeNull();
  });
});
