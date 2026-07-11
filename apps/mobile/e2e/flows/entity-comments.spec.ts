import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';

// A seeded attendee posts a comment on the seeded event. The comment goes
// through commentsService -> Firestore emulator -> the real UI list, so the
// strong assertion is the comment body reappearing on screen after the round
// trip — mirroring register-to-event.spec.ts's shape (anon feed -> fixture
// login -> navigate to event detail -> interact).
const COMMENT_BODY = `Comentario E2E ${Date.now()}`;

test.describe('post a comment on an entity', () => {
  test('logs in → opens event detail → posts a comment → it appears in the list', async ({ page }) => {
    // 1. Anonymous visitor lands on the public Explora feed and sees the event.
    await page.goto('/');
    await expect(page.getByText(fixtures.event.title)).toBeVisible({ timeout: 30_000 });

    // 2. Sign in as the seeded attendee via the emulator-only fixture-login seam.
    await fixtureLogin(page, fixtures.attendee.email);

    // 3. Open the event detail screen where EntityComments renders.
    await page.goto(`/event/${fixtures.event.docId}`);
    const commentInput = page.getByTestId('comment-input');
    await expect(commentInput).toBeVisible({ timeout: 30_000 });

    // 4. Compose and send a comment.
    await commentInput.fill(COMMENT_BODY);
    await page.getByTestId('comment-send').click();

    // 5. Strong assertion: the comment body appears in the rendered list.
    await expect(page.getByText(COMMENT_BODY)).toBeVisible({ timeout: 15_000 });
  });
});
