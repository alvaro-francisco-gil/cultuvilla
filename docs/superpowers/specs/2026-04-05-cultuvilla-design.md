# Villa Events — Design Spec

## Overview

A mobile-first web application for village communities to organize and participate in local events. Villages are the central entity — each village has organizations that create events, and users who sign up. The platform is publicly browsable without an account; participation requires authentication and (optionally) village membership.

## Core Concepts

- **Village**: A real-world village with its community. Has one admin, members, and organizations.
- **User**: An authenticated person. Can belong to multiple villages. Can manage personas.
- **Persona**: A proxy profile (up to 50 per user) for people who won't use the app themselves (e.g., elderly family). Has its own name, birthday, optional bio and photo.
- **Organization**: A group within a village (types: ayuntamiento, peña, asociación). Created by user request, approved by village admin. All members can create events.
- **Event**: Created by an organization within a village. Publicly visible. Anyone authenticated can sign up.

## Data Model

### Architecture Decision

Single Firebase project. Data scoped under `villages/{villageId}/` for village-specific data. Firestore collection group indexes enable cross-village queries (e.g., "all my registrations") at constant cost regardless of village count.

### Top-level Collections

#### `users/{userId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| displayName | string | yes | |
| email | string | yes | |
| birthday | timestamp | yes | |
| biography | string | no | |
| telephone | string | no | Required for certain events |
| photoURL | string | no | |
| createdAt | timestamp | yes | |

#### `users/{userId}/personas/{personaId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | |
| birthday | timestamp | yes | |
| biography | string | no | |
| photoURL | string | no | |
| createdAt | timestamp | yes | |

Max 50 personas per user (enforced in app logic + security rules).

#### `admins/{userId}`

Document existence check — if a document exists, the user is an app-wide admin. No fields required.

### Village-scoped Collections

#### `villages/{villageId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | |
| description | string | yes | |
| coordinates | geopoint | yes | |
| comunidadAutonoma | string | yes | |
| provincia | string | yes | |
| images | array of URLs | no | Multiple images allowed |
| adminUserId | string | yes | One admin per village |
| createdAt | timestamp | yes | |

#### `villages/{villageId}/members/{userId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| role | string | yes | `"admin"` or `"user"` |
| joinedAt | timestamp | yes | |

#### `villages/{villageId}/inviteTokens/{tokenId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| createdAt | timestamp | yes | |
| expiresAt | timestamp | no | Optional expiration |
| usageCount | number | yes | Tracks how many times used |

#### `villages/{villageId}/organizations/{orgId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | |
| description | string | no | |
| type | string | yes | `"ayuntamiento"`, `"peña"`, or `"asociación"` |
| status | string | yes | `"pending"`, `"approved"`, or `"rejected"` |
| requestedBy | string (userId) | yes | |
| createdAt | timestamp | yes | |

#### `villages/{villageId}/organizations/{orgId}/members/{userId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| joinedAt | timestamp | yes | |

#### `villages/{villageId}/events/{eventId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | yes | |
| description | string | yes | |
| startDate | timestamp | yes | |
| endDate | timestamp | no | |
| location | object | yes | `{ type: "coordinates" \| "text", coordinates?: geopoint, text?: string }` |
| imageURL | string | no | One image max |
| price | number | no | |
| maxAttendees | number | no | null = unbounded |
| telephoneRequired | boolean | yes | If true, user must have phone on account |
| status | string | yes | `"draft"`, `"published"`, `"cancelled"`, `"completed"` |
| organizationId | string | yes | |
| organizationName | string | yes | Denormalized for display |
| createdBy | string (userId) | yes | |
| createdAt | timestamp | yes | |
| updatedAt | timestamp | yes | |

#### `villages/{villageId}/events/{eventId}/registrations/{regId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| userId | string | yes | |
| personaId | string | no | null = the user themselves |
| name | string | yes | Snapshot from profile/persona |
| status | string | yes | `"confirmed"` or `"waitlisted"` |
| position | number | yes | Order for FIFO waitlist promotion |
| registeredAt | timestamp | yes | |

### Notifications

#### `users/{userId}/notifications/{notificationId}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | yes | `"waitlist_promoted"`, `"event_cancelled"`, `"event_updated"`, `"org_approved"`, `"org_rejected"` |
| title | string | yes | |
| body | string | yes | |
| eventId | string | no | |
| villageId | string | no | |
| read | boolean | yes | Default false |
| createdAt | timestamp | yes | |

## Roles & Access Control

### Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|-------------|
| App-wide admin | Global | Create villages, manage all villages, manage all users |
| Village admin | One village | Generate invite links, approve/reject org requests, manage village info, cancel any event. One per village. |
| Org member | One org in a village | Create/edit/cancel events under that org |
| Village member | One village | Sign up to events, see full attendee lists, request org creation |
| Authenticated user | Global | Browse all events, sign up to any event, manage own profile/personas |
| Anonymous | Global | Browse all events (attendee count only, no names) |

### Access Rules

| Resource | Read | Create | Update | Delete |
|----------|------|--------|--------|--------|
| Villages | Public | App admin | Village admin | App admin |
| Events | Public (draft: org members + village admin only) | Org members | Creator or village admin | Creator or village admin |
| Registrations | Village members: full detail / Others: count only | Any authenticated user | Own registrations only | Own registrations only |
| Organizations | Village members | Any village member (request) | Village admin (approve/reject) | Village admin |
| User profiles | Public (basic info) | On sign-up | Own profile only | — |
| Personas | Owner only | Owner only | Owner only | Owner only |

### Invite Link Mechanism

1. Village admin generates an invite link containing a token
2. Token stored in `villages/{villageId}/inviteTokens/{tokenId}` with optional expiration and usage count
3. User signs up via the link → automatically added to `villages/{villageId}/members/{userId}` with role `"user"`

### Organization Membership

- When a village admin approves an org request, the requesting user is automatically added as the first member
- Existing org members can invite other village members to join the org

## Event Lifecycle

### States

```
draft → published → completed
                  → cancelled
```

- **Draft**: visible only to org members of the creating organization and village admin
- **Published**: visible to everyone, sign-ups open
- **Cancelled**: visible with "cancelled" badge, all registrations notified, no new sign-ups
- **Completed**: automatic transition after end date (or start date if no end date) via Cloud Function

### Registration Flow

1. User opens a published event
2. Selects who to sign up: themselves and/or any of their personas (multi-select)
3. If event has `telephoneRequired: true` → app checks user has phone on their account; blocks sign-up if not
4. For each selected person:
   - If `maxAttendees` is null or confirmed count < max → `status = "confirmed"`
   - Otherwise → `status = "waitlisted"`, assigned next `position` number
5. All sign-ups created in a single Firestore batch

### Waiting List Promotion

Handled by a **Firebase Cloud Function** triggered on registration deletion/cancellation:

1. Query waitlisted registrations for the event, ordered by `position` ascending
2. Promote the first one to `"confirmed"`
3. Create in-app notification for the promoted user

### Cancellation

- User can cancel any of their registrations (self or personas) anytime before the event
- If cancelled registration was confirmed and a waitlist exists → Cloud Function promotes next in line
- Org members and village admin can cancel the entire event → all registrations notified

### Editing Sign-ups

- User can edit their registration details after sign-up (if persona info changed, etc.)
- Cannot add/remove people from an existing sign-up — must cancel and re-register

## Notifications

### In-app System

Notifications stored in `users/{userId}/notifications/{notificationId}`. Displayed in a notification inbox with unread badge.

### Triggers

| Trigger | Notification to |
|---------|----------------|
| Waitlist promotion | The promoted user |
| Event cancelled | All registered users |
| Event details updated | All registered users |
| Org request approved/rejected | The requesting user |

### Future: WhatsApp Integration

- Cloud Functions already create notification documents
- Future integration: a Cloud Function listener forwards notifications to WhatsApp Business API
- User opts in via their phone number (already on profile)

## UI Structure

### Mobile-first Design

#### Pages

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Landing — village discovery or redirect to user's village | No |
| `/village/{id}` | Village home — upcoming events list, village info | No |
| `/village/{id}/event/{eventId}` | Event detail — info, sign-up, attendee list | No (sign-up requires auth) |
| `/login` | Sign in / Sign up (Google + email/password) | No |
| `/login/invite/{token}` | Sign up via invite link, auto-joins village | No |
| `/profile` | User profile — name, birthday, bio, phone, personas | Yes |
| `/profile/personas` | Manage personas (add/edit/delete) | Yes |
| `/notifications` | Notification inbox | Yes |
| `/village/{id}/admin` | Village admin panel — manage village, invite links, org requests | Village admin |
| `/village/{id}/org/{orgId}` | Org page — list of org's events | No |
| `/village/{id}/org/{orgId}/events/new` | Create event | Org member |
| `/village/{id}/org/{orgId}/events/{eventId}/edit` | Edit event | Org member / village admin |
| `/admin` | App-wide admin — manage villages, global overview | App admin |

#### Navigation

- **Bottom tab bar**: Home (village events), My Sign-ups (collection group query across all villages), Notifications (unread badge), Profile
- **Top bar**: village name/logo, hamburger menu for village switching (if user belongs to multiple)

#### Key UI Behaviors

- Event cards: title, date, org name, location, attendee count, status badge (spots left / full / waitlist)
- Sign-up modal: checkboxes for self + each persona, submit button
- Pull-to-refresh on event lists
- Skeleton loaders while data fetches

## Tech Stack

### Existing (keeping)

- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Language**: TypeScript throughout

### Adding

- **`next-intl`**: i18n support — Spanish default, translation-key based for future languages
- **Firebase Cloud Functions**:
  - Waitlist promotion on registration cancellation
  - Automatic event completion (scheduled, checks dates)
  - Notification creation on event changes
- **Firestore collection group indexes**: for cross-village queries

### Project Structure

```
apps/
  web/
    app/
      [locale]/
        (public)/         # No auth required
        (auth)/           # Auth required
        (admin)/          # Admin routes
    components/
    lib/
packages/
  shared/
    src/
      models/             # TypeScript interfaces for all entities
      services/           # Firebase CRUD for each entity
      firebase/           # Firebase initialization
functions/                # Firebase Cloud Functions
```

### Security Approach

- Firestore security rules enforce all access control (roles, ownership, village membership)
- Client-side checks exist for UX only — rules are the source of truth
- Invite tokens validated server-side
- Storage: one image per event (max 5MB, image/* only), multiple images per village
