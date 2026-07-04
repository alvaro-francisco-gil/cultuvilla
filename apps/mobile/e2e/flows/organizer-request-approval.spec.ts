import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin, fixtureSignOut } from '../lib/fixtureLogin';
import { findOrganizerRequestStatus, getVillageMemberRole, waitFor } from '../lib/emulatorState';

// Two actors on one page. A member asks to organize a started-but-organizer-less
// village; a super-admin approves it from the Solicitudes inbox. The strong
// assertions are the backend effects: the organizerRequest flips to `approved`
// and the requester is promoted to an `admin` member of that village.
test.describe('organizer request → super-admin approval', () => {
  test('member requests → super-admin approves → requester becomes village admin', async ({
    page,
  }) => {
    const village = fixtures.organizerlessVillage.docId;

    // ── Requester: the attendee (phone is pre-seeded, so the phone-gated submit
    //    passes without driving the field). ──
    await page.goto('/');
    await fixtureLogin(page, fixtures.attendee.email);

    await page.goto(`/discover/organize/${village}`);
    const submit = page.getByTestId('organize-submit');
    await expect(submit).toBeVisible({ timeout: 30_000 });
    await submit.click();

    await waitFor(
      () => findOrganizerRequestStatus({ municipalityId: village, userId: fixtures.attendee.uid }),
      (s) => s === 'pending',
      { timeoutMs: 20_000 },
    );

    // ── Approver: the super-admin sees the request in the Recibidas inbox. ──
    await fixtureSignOut(page);
    await fixtureLogin(page, fixtures.superAdmin.email);
    await page.goto('/solicitudes');

    const approve = page.locator('[data-testid^="approve-organizer-"]').first();
    await expect(approve).toBeVisible({ timeout: 30_000 });
    await approve.click();

    // Strong assertions: request approved + requester promoted to village admin.
    await waitFor(
      () => findOrganizerRequestStatus({ municipalityId: village, userId: fixtures.attendee.uid }),
      (s) => s === 'approved',
      { timeoutMs: 20_000 },
    );
    expect(await getVillageMemberRole(village, fixtures.attendee.uid)).toBe('admin');
  });
});
