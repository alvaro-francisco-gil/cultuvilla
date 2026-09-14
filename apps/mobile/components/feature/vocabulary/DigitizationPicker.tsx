import type { Dispatch, SetStateAction } from 'react';
import { OrganizerPicker } from '../OrganizerPicker';
import { useT } from '../../../lib/i18n';

export interface DigitizationCredit {
  userIds: string[];
  orgIds: string[];
}

export const EMPTY_DIGITIZATION_CREDIT: DigitizationCredit = { userIds: [], orgIds: [] };

/**
 * "¿Quién lo ha digitalizado?" — the villagers and groups credited alongside
 * the author. The author is a locked row: `creditedUserIds` puts them back in
 * on write anyway, and `firestore.rules` rejects a credit that leaves them out,
 * so offering to remove them would only produce a form that cannot submit.
 */
export function DigitizationPicker({
  municipalityId,
  authorId,
  value,
  onChange,
}: {
  municipalityId: string;
  authorId: string;
  value: DigitizationCredit;
  /**
   * A state setter, not a plain callback: people and groups are two separate
   * picker events, and each must update from the *latest* credit. Building the
   * next value from the `value` captured at render lets one change silently
   * overwrite the other when both land in the same tick — that is how a
   * credited neighbour got dropped before this was a functional update.
   */
  onChange: Dispatch<SetStateAction<DigitizationCredit>>;
}) {
  const { t } = useT();
  const selectedUserIds = value.userIds.includes(authorId)
    ? value.userIds
    : [authorId, ...value.userIds];
  return (
    <OrganizerPicker
      municipalityId={municipalityId}
      selectedUserIds={selectedUserIds}
      selectedOrgIds={value.orgIds}
      lockedUserId={authorId}
      onChangeUsers={(userIds) => onChange((prev) => ({ ...prev, userIds }))}
      onChangeOrgs={(orgIds) => onChange((prev) => ({ ...prev, orgIds }))}
      peopleLabel={t('village.contributors.peopleLabel')}
      addPersonLabel={t('village.contributors.addPerson')}
      selectPeopleTitle={t('village.contributors.selectPeople')}
    />
  );
}
