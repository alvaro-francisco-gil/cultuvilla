import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin, fixtureSignOut } from '../lib/fixtureLogin';
import { findOrganization, isOrgMember, waitFor } from '../lib/emulatorState';

const ORG_NAME = 'Peña E2E Nueva';

// Three actors on one page: a villager proposes a peña (pending), a village admin
// approves it, and a third user joins. Strong assertions are the Firestore
// effects at each hop.
//
// NOTE (flagged): the join FAB currently calls addOrgMember directly (a client
// membership write) rather than the documented requestJoinOrganization →
// respondToJoinRequest round-trip (AGENTS.md "Join org" row). This flow asserts
// the CURRENT behavior — a member doc appears immediately on join — not the
// request/approve journey. If the FAB is rewired to use join requests, update
// the join step here to drive the Solicitudes approve-join control instead.
test.describe('organization: create → approve → join', () => {
  test('villager proposes peña → admin approves → third user joins', async ({ page }) => {
    const village = fixtures.village.docId;

    // ── Villager proposes the peña (status pending). ──
    await page.goto('/');
    await fixtureLogin(page, fixtures.attendee.email);

    await page.goto(`/village/${village}/organizations`);
    const name = page.getByTestId('org-name-input');
    await expect(name).toBeVisible({ timeout: 30_000 });
    await name.fill(ORG_NAME);
    await page.getByTestId('org-submit').click();

    const pending = await waitFor(
      () => findOrganization({ municipalityId: village, name: ORG_NAME }),
      (o) => o?.status === 'pending',
      { timeoutMs: 20_000 },
    );
    const orgId = pending!.id;

    // ── Village admin approves it from the Recibidas inbox. ──
    await fixtureSignOut(page);
    await fixtureLogin(page, fixtures.admin.email);
    await page.goto('/solicitudes');

    const approve = page.locator('[data-testid^="approve-org-"]').first();
    await expect(approve).toBeVisible({ timeout: 30_000 });
    await approve.click();

    await waitFor(
      () => findOrganization({ municipalityId: village, name: ORG_NAME }),
      (o) => o?.status === 'approved',
      { timeoutMs: 20_000 },
    );

    // ── A third user joins from the org detail screen. ──
    await fixtureSignOut(page);
    await fixtureLogin(page, fixtures.joiner.email);
    await page.goto(`/o/${orgId}`);

    const joinFab = page.getByTestId('join-org-fab');
    await expect(joinFab).toBeVisible({ timeout: 30_000 });
    await joinFab.click();

    // Strong assertion: the joiner now has a member doc under the org.
    await waitFor(
      () => isOrgMember(orgId, fixtures.joiner.uid),
      (member) => member === true,
      { timeoutMs: 20_000 },
    );
  });
});
