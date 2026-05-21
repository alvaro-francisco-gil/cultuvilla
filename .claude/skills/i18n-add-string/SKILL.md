---
name: i18n-add-string
description: Use whenever adding or changing a user-facing string in either the Next.js web app or the React Native mobile app. Encodes the shared message-catalog layout (packages/i18n/), the namespace-by-feature rule, the dual-app consumption contract (next-intl on web, useT() adapter on mobile), and the "hardcoded Spanish allowed only in dev-only web admin surfaces" carve-out.
---

# Add a user-facing string

Cultuvilla has two apps that share a single message catalog:

- **`apps/web`** — Next.js, consumes the catalog via `next-intl` v4.
- **`apps/mobile`** — Expo / React Native, consumes the catalog via the thin `useT()` adapter in `apps/mobile/lib/i18n.tsx`.

The catalog lives in **`packages/i18n/messages/es.json`** (nested JSON). The default locale is `es`. A single key added here is immediately available in both apps.

## When this applies

- Adding a new label, button text, error message, placeholder, or notification copy in a component either app's end-user sees.
- Replacing an English or hardcoded-Spanish string left in source code with the localised version.

**Carve-out:** hardcoded Spanish is **allowed** in dev-only web admin surfaces — admin panels, debug pages, internal tools where i18n is not a current priority. Mobile has no admin surfaces in v1, so this carve-out is web-only for now. If in doubt: "would a non-admin user see this?" — yes → i18n; no → fine as-is (on web).

## Procedure

### 1. Pick a namespace

Namespaces group strings by **feature area**, not by component. `events`, `personas`, `villageOnboarding`, `auth`, `feed`. A component re-using strings from multiple namespaces is normal.

Open [`packages/i18n/messages/es.json`](../../../packages/i18n/messages/es.json). Look for an existing namespace that fits. If none does, add a new top-level key.

### 2. Add the key (nested JSON)

Choose a stable, descriptive key. Avoid copy-as-key (`"Save"` as the key) because copy changes more often than meaning.

```json
{
  "events": {
    "createButton": "Crear evento",
    "fullNotice": "Este evento está completo. Puedes apuntarte a la lista de espera.",
    "registrationConfirmed": "Te has apuntado correctamente."
  }
}
```

If the string is parameterised, use ICU syntax (supported by both next-intl and the mobile adapter):

```json
{
  "events": {
    "attendeeCount": "{count, plural, =0 {Sin asistentes} one {1 asistente} other {# asistentes}}"
  }
}
```

**Dotted-path lookup works in both apps:**
- `next-intl` on web handles nested JSON natively — `t('createButton')` inside `useTranslations('events')`.
- The mobile `useT()` adapter resolves the full key `events.createButton` by splitting on `.` and walking the nested object — so the same catalog structure is traversed correctly.

### 3. Render the string

**Web (Next.js) — client component:**

```tsx
import { useTranslations } from 'next-intl';

export function CreateEventButton() {
  const t = useTranslations('events');
  return <button>{t('createButton')}</button>;
}
```

**Web (Next.js) — server component:**

```tsx
import { getTranslations } from 'next-intl/server';

export default async function EventPage() {
  const t = await getTranslations('events');
  return <h1>{t('title')}</h1>;
}
```

**Mobile (React Native):**

```tsx
import { useT } from '@/lib/i18n';

export function CreateEventButton() {
  const t = useT();
  return <Pressable><Text>{t('events.createButton')}</Text></Pressable>;
}
```

The mobile adapter takes the full dotted path (`namespace.key`) rather than a scoped namespace. For parameterised strings, pass values as a second argument — the adapter applies ICU-style interpolation.

### 4. Decide on other locales

Cultuvilla's MVP ships in Spanish only. If a non-`es` locale file exists in `packages/i18n/messages/` and is wired up, add the key to that file too with `TODO: translate` as the value. Otherwise leave the other-locale work for a future translation pass.

## What NOT to do

- **Don't hardcode Spanish in a user-facing component** (on either app). It bypasses the catalogue and makes future translation a grep-and-replace nightmare.
- **Don't use the English copy as the key.** When the Spanish text changes, the key changes too, and every translation breaks.
- **Don't `as any` your way around a missing-namespace type error.** Add the key to the catalogue.
- **Don't add the same string under two namespaces.** Pick one and reuse.
- **Don't use string concatenation in a translated message.** `${t('hello')} ${name}` works but breaks word order in languages with different grammar — use ICU placeholders instead.
- **Don't add strings to `apps/web/i18n/messages/` directly** — that path is gone; the catalog is now in `packages/i18n/messages/`.

## When the string is dev-only (web only)

Admin pages, debug panels, internal-only routes on the **web app** — hardcoded Spanish (or English, whatever's easiest to read while building) is fine there. If the page is gated behind `isAppAdmin`, that's the signal: not user-facing.

Mobile has no admin surfaces in v1, so every mobile string is user-facing. When in doubt on mobile, always use the catalog.

## When this skill applies

- The user asks to "add a button labelled X" / "show an error when Y" / "rename Z in the UI" on either app.
- A grep finds Spanish or English strings outside `packages/i18n/messages/` in user-facing source files.
- A new component in `apps/web` or `apps/mobile` is shipping with a hardcoded string.

## Companion skills

- None — this is self-contained.
