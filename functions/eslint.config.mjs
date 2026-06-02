// functions/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Phase 2 scope: event-touching handlers migrated in Task 13.
    // Each collection-migration commit adds the touched function files to
    // this glob until Phase 4 flips it to src/**.
    files: [
      'src/registerToEvent.ts',
      'src/waitlistPromotion.ts',
      'src/notificationTriggers.ts',
      'src/syncVillageDenormalization.ts',
      'src/acceptInvite.ts',
      'src/requestJoinVillage.ts',
      'src/respondToJoinRequest.ts',
      'src/updateCenso.ts',
      'src/requestOrganizeVillage.ts',
      'src/respondToOrganizerRequest.ts',
      'src/onOccupationProposalApproved.ts',
      'src/helpers/notifyRequests.ts',
      'src/news/deleteNewsPost.ts',
      'src/news/moderateNewsPost.ts',
      'src/news/resolveNewsReport.ts',
      'src/news/setTrustedNewsAuthor.ts',
      'src/news/syncNewsCommentCount.ts',
      'src/news/syncNewsReactionCounts.ts',
    ],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['lib/**', 'dist/**', 'node_modules/**'],
  },
);
