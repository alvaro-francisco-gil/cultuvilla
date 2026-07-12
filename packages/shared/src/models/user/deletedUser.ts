/**
 * Sentinel uid substituted for `createdBy` on news/event docs whose author
 * account was deleted. The docs themselves are kept (not deleted); display
 * layers resolve this value to a "deleted user" label rather than a real
 * profile lookup.
 */
export const DELETED_USER_UID = 'deleted-user';
