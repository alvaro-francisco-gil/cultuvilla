import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin, fixtureSignOut } from '../lib/fixtureLogin';
import { findOrganization, isOrgMember, waitFor } from '../lib/emulatorState';

const ORG_NAME = 'Peña E2E Nueva';

// Three actors on one page: a villager proposes a peña (pending), a village admin
// approves it, and a third user joins. Strong assertions are the Firestore
// effects at each hop.
//
// Joining is instant self-service (AGENTS.md): the FAB writes the joiner's own
// member doc directly, gated by rules (a user may add only themselves). This
// mirrors village join — no request/approve round-trip.
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

    // ── Village admin approves it from the Buzón's actionable section. ──
    await fixtureSignOut(page);
    await fixtureLogin(page, fixtures.admin.email);
    await page.goto('/inbox');

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
