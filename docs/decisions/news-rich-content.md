# News rich content — block editor, not contenteditable

## Context

News started as flat `title` + `body: string` + a flat `images[]`. The product
goal was WordPress-like authoring: interleaved paragraphs and images, a dedicated
card cover, and `@`-mentions of village entities. The hard constraint is that
**React Native has no `contenteditable`** — a single `TextInput` cannot host an
image between two paragraphs, so a rich-text-in-one-field approach is impossible
on the mobile target.

## Decision

- **The body is an ordered list of blocks, not a rich string.**
  `NewsPost.content: NewsBlock[]` where a block is either
  `{ type: 'text'; text; mentions }` or
  `{ type: 'image'; storagePath; width; height; caption? }`. This is the
  Gutenberg/WordPress-mobile model. The editor manipulates discrete blocks
  (add text / add image, up-down reorder) rather than a contenteditable region.
- **`coverImage` is separate from inline images.** A dedicated cover
  (`NewsPostImage | null`) drives the feed card and og:image; it is picked in
  its own stepper step, distinct from images embedded in `content`.
- **Legacy `body` is kept as a read-time fallback, not migrated away.** On read,
  when `content` is empty, a single text block is synthesized from `body` so
  pre-existing posts and seed data keep rendering. Model fields use
  `.default([])` / `.default(null)` so the strict Zod converter tolerates old
  docs. This is a deliberate, bounded exception to the "no retrocompat shims"
  rule — the alternative (a hard content migration of every historical post)
  buys nothing at current volume.
- **Mentions are stored inline with the block, snapshotting the label.** A
  `Mention` carries `entityType` (`organization | user | event | place`),
  `entityId`, a `label` snapshot of the display name at insert time, and an
  `offset`/`length` into the block text. The label snapshot means a renamed org
  doesn't retro-rewrite historical news; the deep-link still resolves by id.
- **Mention targets required a `places` collection.** Orgs/users/events already
  existed; places did not (events only carried `LatLng`). Places shipped as a
  first-class `municipalityId`-scoped collection, which is what made
  place-mentions possible. They now follow the optimistic visibility model for
  moderation.

## Rejected alternatives

- **Rich-text string with markup (HTML/Markdown in `body`).** No RN
  contenteditable to author it, and rendering arbitrary inline images from a
  string is exactly the block problem in disguise.
- **Hard-migrating `body` → `content` for all posts.** Unnecessary churn on
  historical/seed data; the read-time synthesis covers rendering for free.
- **Drag-to-reorder blocks in v1.** RN drag reorder is fiddly; up/down arrows
  ship the capability now, drag can come later without a model change.

## What this binds

- The feed card cover reads `coverImage` first, then falls back to `images[0]`.
- Anything reading `NewsPost` must handle the empty-`content`/legacy-`body` case
  (the synthesized-block fallback), not assume `content` is populated.
- `Mention.entityType` is an open enum by design — adding a target type is a
  value addition, not a rework.

## Revisit when

- `images[]` can be retired once every live post has inline images in `content`
  (currently kept for back-compat).
- If mention offset/length prove fragile under heavy editing, switch to inline
  sentinel tokens + a parallel array (the token-based scheme considered here).
