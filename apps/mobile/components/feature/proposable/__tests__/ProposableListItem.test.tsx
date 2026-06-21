import { render, fireEvent } from '@testing-library/react-native';
import { ProposableListItem } from '../ProposableListItem';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

const base = {
  name: 'Plaza Mayor',
  imageURL: null,
  status: 'pending' as const,
};

describe('<ProposableListItem>', () => {
  it('a stranger viewing a pending item sees the badge and no actions', () => {
    const { queryByTestId } = render(
      <ProposableListItem {...base} canManage={false} isOwnPending={false} />,
    );
    expect(queryByTestId('pending-badge')).toBeTruthy();
    expect(queryByTestId('action-approve')).toBeNull();
    expect(queryByTestId('action-reject')).toBeNull();
    expect(queryByTestId('action-edit')).toBeNull();
    expect(queryByTestId('action-withdraw')).toBeNull();
    expect(queryByTestId('action-delete')).toBeNull();
  });

  it('an organizer viewing a pending item can approve/reject/edit/delete', () => {
    const onApprove = jest.fn();
    const { queryByTestId, getByTestId } = render(
      <ProposableListItem
        {...base}
        canManage
        isOwnPending={false}
        onApprove={onApprove}
        onReject={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(queryByTestId('action-approve')).toBeTruthy();
    expect(queryByTestId('action-reject')).toBeTruthy();
    expect(queryByTestId('action-edit')).toBeTruthy();
    expect(queryByTestId('action-delete')).toBeTruthy();
    fireEvent.press(getByTestId('action-approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('a proposer viewing their own pending item can edit/withdraw but not approve/delete', () => {
    const onWithdraw = jest.fn();
    const { queryByTestId, getByTestId } = render(
      <ProposableListItem
        {...base}
        canManage={false}
        isOwnPending
        onEdit={jest.fn()}
        onWithdraw={onWithdraw}
      />,
    );
    expect(queryByTestId('action-edit')).toBeTruthy();
    expect(queryByTestId('action-withdraw')).toBeTruthy();
    expect(queryByTestId('action-approve')).toBeNull();
    expect(queryByTestId('action-delete')).toBeNull();
    fireEvent.press(getByTestId('action-withdraw'));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('an approved item shows no pending badge; organizer still edits/deletes', () => {
    const { queryByTestId } = render(
      <ProposableListItem
        {...base}
        status="approved"
        canManage
        isOwnPending={false}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(queryByTestId('pending-badge')).toBeNull();
    expect(queryByTestId('action-approve')).toBeNull();
    expect(queryByTestId('action-edit')).toBeTruthy();
    expect(queryByTestId('action-delete')).toBeTruthy();
  });
});
