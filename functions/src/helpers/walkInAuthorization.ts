/**
 * Pure authorization check for addWalkInRegistration.
 * Control = named organizer (organizerUserIds) OR village admin OR app admin.
 * Org members NOT in organizerUserIds have no implicit control.
 */
export interface WalkInAuthContext {
  uid: string;
  organizerUserIds: string[];
  isVillageAdmin: boolean;
  isAppAdmin: boolean;
}

export function isWalkInAuthorized(ctx: WalkInAuthContext): boolean {
  return (
    ctx.organizerUserIds.includes(ctx.uid) ||
    ctx.isVillageAdmin ||
    ctx.isAppAdmin
  );
}
