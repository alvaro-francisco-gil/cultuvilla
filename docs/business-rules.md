# Cultuvilla — Business Rules

The single source of truth for **what the product allows and forbids** — the rules
that govern users, villages, events, and content. It complements, and where they
disagree overrides, the prose in [README.md](../README.md) and the per-feature
rationale in [docs/decisions/](decisions/).

> **Scope of this document:** the *rules*, not the implementation. Where a rule
> currently disagrees with the code, that is called out in
> [§13 Known code discrepancies](#13-known-code-discrepancies-to-reconcile). Items
> still under discussion are in [§11 Open questions](#11-open-questions) and
> [§12 Deferred](#12-deferred-handled-on-other-branches).

---

## 1. Glossary & core entities

| Term | Meaning | Where it lives |
|---|---|---|
| **Municipality** | A fixed, predefined Spanish *ayuntamiento*. Always exists as a reference doc, whether or not anyone uses the app there. | `municipalities/{id}` |
| **Community** | The activatable *overlay* on a municipality. Flips on when someone organizes the village. **One community per municipality.** | `municipalities/{id}.community` |
| **Village** | Colloquial word for *a municipality with an active community*. Not a separate entity. | — |
| **Person** | A canonical identity record (name, surnames, sex, birthday, birthplace, biography, photo). The unit a registration points at. | `persons/{personId}` |
| **User account** | Account metadata for a signed-in user (display name, email, telephone, active village, link to own Person). | `users/{uid}` |
| **Organization** | An *ayuntamiento*, *peña*, or *asociación*. Belongs to exactly one municipality. | `organizations/{orgId}` |

**Person vs. user account.** Every user has their **own Person** (`users/{uid}.personId`,
where that Person's `userId == uid`). A user may also create **additional Person
records for relatives** (`userId == null`, `createdBy == uid`) so they can register
family members. "Persona" in older docs = a Person record; it is **not** a user type.

**Village = municipality + community.** There is no `villages/` collection; the
canonical collection is `municipalities/`. "Village" is only a human label for a
municipality whose `community.active == true`.

---

## 2. User types & roles

Roles **compose** — an org member is also a village member is also an authenticated
user.

| Role | Defined by | Core capability |
|---|---|---|
| **Anonymous visitor** | not signed in | Browse public events & approved news. Sees attendee **counts only**, never names. |
| **Authenticated user** | signed in | Everything above + register to **any** event in **any** village, manage own account + Persons, author/comment/react on news. |
| **Village member** | `municipalities/{id}/members/{uid}` (`role: user`) | Member of a specific village. Sees attendee **names** for that village's events. Subject to that village's censo. |
| **Village admin** | `municipalities/{id}/members/{uid}` (`role: admin`) | Manage the village: approve join requests, moderate news, manage barrios/cemeteries, edit/cancel any event in the village, approve org-creation requests. |
| **Org member** | `organizations/{orgId}/members/{uid}` | Create/manage that org's events. |
| **Superadmin** | `admins/{uid}` | Global. Creates municipalities, approves organizer requests, manages reference data, and holds full village-admin powers everywhere. |

**Admins are not a singleton.** A village can have **multiple admins**. The founding
organizer (`community.adminUserId`) is the first admin; existing admins can promote
other members to admin.

**Multi-village.** A user may be a member (or admin) of **many villages at once**.
`activeMunicipalityId` on the user account selects which village the UI focuses on —
it is a **UI hint only and never an access-control primitive** (tolerate `null`).

---

## 3. Becoming & leaving a village member

### 3.1 Joining (three pathways)

1. **Request to join** — the user requests; a **village admin approves**. Requests
   are keyed by uid (`municipalities/{id}/joinRequests/{uid}`) so duplicates are
   structurally impossible; one pending request per user per village.
2. **Invite token** — an admin shares a token; the user redeems it. *(Rules deferred —
   see [§12](#12-deferred-handled-on-other-branches).)*
3. **Organize an inactive village** — the user requests to organize a municipality
   with no active community; a **superadmin approves**, which activates the community
   and makes the requester the founding admin.

All request writes go through Cloud Function callables (clients never write the
request/membership docs directly); guardrails run server-side in a transaction
(not already a member, no prior pending request, target community active for join /
inactive for organize).

### 3.2 Trust model

There is **no verification of real-world residency**. "Village member" is an
app-relationship established by **admin approval or a valid invite** — never by
self-assertion. The censo's residency fields are **self-reported and unverified**.

### 3.3 Leaving

- A member may **leave voluntarily**; a **village admin may remove** a member.
- On exit: the member's **future event registrations are cancelled** (freeing
  capacity) and their **censo answers are deleted**.
- The **last admin must promote another admin before leaving**.

---

## 4. The censo (per-village profile form)

- Each village's admin defines a **censo** — a profile form capturing pueblo-specific
  info (barrio, residency type, household, …). Schema is **publicly readable**;
  answers are visible only to authenticated co-members.
- **Member-only.** The censo is the village's census of *its own members*. A member's
  answers live on their membership doc (`profileAnswers` + `profileCompletedAt`).
  **Visitors have no censo.**
- **Lazy fill, gated at first registration.** Joining never prompts the censo. A
  member who has not completed required censo fields is **force-prompted the first
  time they register to one of that village's events**; the gate is enforced
  **server-side**, the client redirect is a convenience.
- **Fields** are either **predefined** (from a code registry with stable cross-village
  keys) or **custom** (village-local, admin-defined).
- **Append-only after first answer:** a field can be removed only while zero members
  have answered it; select options can be appended but not removed once selected;
  field `type` and `key` are immutable.

See [docs/decisions/village-censo.md](decisions/village-censo.md).

---

## 5. Persons (identity records)

- A Person is **owner-only**: only its `createdBy` can read, write, or delete it.
- A user has **one self-Person** (`userId == uid`) and may create **any number of
  relative-Persons** (`userId == null`). **No cap.**
- **Registrations always point at a Person** the registering user owns (self or
  relative). There is no anonymous/nameless registration.
- **Deleting a Person cascades** — its event registrations are removed too (freeing
  capacity and triggering waitlist promotion). There is no "block delete while
  registered."
- Standalone Persons not tied to an account (e.g. deceased ancestors for a future
  family tree) are allowed by the model but not a v1 product surface.

See [docs/decisions/persons-registry.md](decisions/persons-registry.md).

---

## 6. Organizations

- **Types:** `ayuntamiento` (**max one per village**), `peña`, `asociación`
  (**unlimited**).
- **Creation:** a village member **requests** an org; a **village admin approves or
  rejects**. *(The request→approval flow is a rule here; it is not yet built — see
  [§13](#13-known-code-discrepancies-to-reconcile).)*
- **Org membership:** each org has its own **admin(s)** who invite/approve members.
  **Org-members create and manage that org's events.**
- **One org belongs to one village.** Multi-village organizations are explicitly
  future (would add `villageIds[]` / `parentOrgId`).

---

## 7. Events

### 7.1 Identity & scope

- An event happens in **exactly one village** (`municipalityId` = the location),
  regardless of how many people or orgs co-organize it.
- **No price / payment concept.** Money is never mentioned natively in the app; any
  cost is handled offline by the organizer. *(The model still carries a `price`
  field — see [§13](#13-known-code-discrepancies-to-reconcile).)*

### 7.2 Who creates & who is credited

- **Any member of the event's village can create an event** there.
- An event's **organizers are a set**: zero-or-more **users** and zero-or-more **orgs**.
  The **creator is always an organizer**. Valid shapes: self-only, org(s)-name-only,
  or self + org(s); multiple users *and* multiple orgs may co-organize.
- **Co-organizers must belong to the same village as the event.** Any member of that
  village can add any other member, or any organization of that village, as a
  co-organizer — **with no consent or approval step.**

### 7.3 Lifecycle

```
draft ── publish ──▶ published ── cancel ──▶ cancelled   (terminal)
                          │
                          └── auto (dates pass) ──▶ completed
```

- **Linear and one-way.** No un-publish, no reopen; **cancel is terminal**.
- `completed` is set **automatically** when `startDate`/`endDate` passes (scheduled).
- **Drafts are visible only to the event's organizers.**

### 7.4 Edit & cancel permissions

Edit or cancel an event may be done by:
- any **co-organizer user**, or
- any **member of a co-organizing org**, or
- a **village admin** of the event's village, or
- a **superadmin**.

Editing a published event with registrants:
- changing **title / date / location** notifies all registrants (`event_updated`);
- **cancelling** notifies all registrants (`event_cancelled`).

---

## 8. Event registration

- **Instant and capacity-gated** — no organizer approval.
- **Open to any authenticated user**, member or not (membership never gates
  participation). The censo gate (§4) applies only to members of the event's village.
- Each registration is for **one Person** owned by the registering user.
- **Uniqueness:** at most **one registration per (event, Person)** — no double
  registration.
- **Capacity:** `maxAttendees` counts **confirmed registrations only**.
  - `confirmedCount < maxAttendees` → `confirmed`; otherwise → `waitlisted`.
  - `maxAttendees == null` → **unlimited**; never waitlists.
- **Waitlist:** ordered FIFO by `position`. When a confirmed registration is
  cancelled, the **lowest-position waitlister is auto-promoted** (notified via
  `waitlist_promoted`) and counters are recomputed.
- `telephoneRequired` (per event): when true, the registrant must have a telephone on
  file before registering.

### 8.1 Attendee privacy

| Viewer | What they see |
|---|---|
| Anonymous visitor | Attendee **count** only |
| Authenticated **non-member** of the event's village | Attendee **count** only |
| **Member** of the event's village | Full attendee **names** |
| The event's **organizers** (+ superadmin) | Full attendee **names** |

Registrations denormalize the attendee `name` and an `isMember` badge (member of the
event's village vs. visitor) so lists need no per-attendee lookup.

---

## 9. News (noticias)

- Lives in **top-level collections** scoped by `municipalityId`: `news/`,
  `newsComments/`, `newsReactions/`, `newsReports/`.
- **Authoring:** **any authenticated user** may post to any village's news. Posts are
  created **`pending`** and **reviewed by the village's admins** (+ superadmin), who
  approve or reject. A member flagged `trustedNewsAuthor` for that village posts
  **directly as `approved`** (trust is per-village and dies with the membership; set
  only via the `setTrustedNewsAuthor` callable).
- **Reading:** **approved** posts are **public** (anonymous included). `pending`/hidden
  posts are visible only to their author, village admins, and superadmins.
- **Authors** can **edit** (never re-enters moderation) and **delete their own** posts.
  Admins can **delete any** post (cascade).
- **Comments & reactions:** **any authenticated user** may comment and react. Comments
  **auto-publish** (no queue). One reaction per (user, post) (deterministic id
  `${postId}_${userId}`).
- **Reports:** **comments only** in v1. Resolving a report **hides** the comment (does
  not delete it).
- Privileged writes are callables (`moderateNewsPost`, `deleteNewsPost`,
  `resolveNewsReport`, `setTrustedNewsAuthor`); counters are denormalized and **not
  clamped** (may drift on partial failure — do not assume exact).

See [docs/decisions/news-feed.md](decisions/news-feed.md).

---

## 10. Reference data

- **Municipalities** and the **occupations** list are **superadmin-managed**.
- **Barrios** and **cemeteries** are managed by **each village's admin** (local
  knowledge), under their municipality.
- **Occupation proposals:** any user can **propose** a new occupation (stored as
  *pending* on their Person). A **superadmin approves** it, which promotes it to a
  canonical occupation and **migrates pending references** across Persons.

### 10.1 Notifications

In-app only (`users/{uid}/notifications`); **push is deferred**. Types:
`join_request_created` / `_approved` / `_rejected`, `organizer_request_created` /
`_approved` / `_rejected`, `event_cancelled`, `event_updated`, `waitlist_promoted`.

### 10.2 Account deletion

A user may delete their account. Handling is **hybrid**:

- **Cascaded / removed:** their owned Persons (and those Persons' registrations),
  village memberships (cancelling future registrations), events they **solely**
  organize (cancelled), and they are **dropped from the organizer set** of
  co-organized events.
- **Preserved:** their **news posts and comments** are kept (author anonymized, e.g.
  "Usuario eliminado") for community-record continuity.

---

## 11. Open questions

| # | Question | Current lean |
|---|---|---|
| OQ-1 | Must an **org member also be a member of that org's village**? | Lean: being added to an org **auto-creates** village membership if absent. **Pending cofounder discussion.** |

---

## 12. Deferred (handled on other branches)

- **Invite tokens** — generation, single/multi-use, expiry, max-uses, revocation.
  Being designed on a parallel branch.
- **Community deactivation / archival** — whether and how an active community can be
  turned off. Being designed on a parallel branch. *(Activation itself is settled: a
  community becomes active when an organizer request is approved and a village
  organizer exists.)*

---

## 13. Known code discrepancies to reconcile

These rules are **authoritative**; the code below currently disagrees and should be
brought into line.

| Rule | Code today | Action |
|---|---|---|
| **No price/payment** (§7.1) | `EventDataModel` has a `price` field | Remove the field (or leave permanently unused) |
| **Organizers are a set** of users + orgs (§7.2) | Event has a single required `organizationId` / `organizationName` + `createdBy` | Replace with an organizer set (`users[]` + `orgs[]`); migrate existing events |
| **Org creation = member-request → admin-approval** (§6) | No org-request/approval flow exists | Build the request + approval callables |
| **Village = municipality + community** (§1) | Some docs/paths say `villages/{id}`; code uses `municipalities/{id}` | Treat `municipalities/` + `community` overlay as canonical; "village" is colloquial only |
