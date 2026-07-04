import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { getUserPersonId, personExists, waitFor } from '../lib/emulatorState';

// A freshly-authenticated user with no profile is diverted to complete-profile
// by the AuthGate (authRoute: no personId → /(onboarding)/complete-profile). The
// flow fills the required identity + birthday fields and submits; the strong
// assertion is the backend effect — a persons/{id} doc plus the users/{uid}
// profile that links it, which is exactly what authRoute reads to consider the
// user onboarded.
test.describe('onboarding: complete profile', () => {
  test('fresh user signs in → completes profile → person + profile land in Firestore', async ({
    page,
  }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.fresh.email);

    // AuthGate redirects the profile-less user here; the given-name field is our
    // proof we landed on complete-profile rather than the tabs.
    const givenName = page.getByTestId('person-given-name');
    await expect(givenName).toBeVisible({ timeout: 30_000 });

    // Step 1 — identity.
    await givenName.fill('Nueva');
    await page.getByTestId('person-first-surname').fill('Vecina');
    await page.getByTestId('person-second-surname').fill('DePrueba');
    await page.getByTestId('person-sex-female').click();
    await page.getByTestId('person-form-primary').click();

    // Step 2 — residence: only the birthday is required (requireFullName). Pick a
    // recent-ish year so it renders within the list's initial window.
    await page.getByTestId('birthday-year').click();
    await page.getByTestId('birthday-year-option-1990').click();
    await page.getByTestId('birthday-month').click();
    await page.getByTestId('birthday-month-option-5').click();
    await page.getByTestId('birthday-day').click();
    await page.getByTestId('birthday-day-option-15').click();
    await page.getByTestId('person-form-primary').click();

    // Step 3 — about: everything optional, submit straight away.
    await page.getByTestId('person-form-primary').click();

    // Strong assertion: the profile now links a person, and that person exists.
    const personId = await waitFor(
      () => getUserPersonId(fixtures.fresh.uid),
      (id) => id !== null,
      { timeoutMs: 20_000 },
    );
    expect(personId).toBeTruthy();
    expect(await personExists(personId as string)).toBe(true);
  });
});
