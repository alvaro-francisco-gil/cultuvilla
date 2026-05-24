import type { ProfileAnswers } from './CensoTypes';

export type VillageMemberRole = 'admin' | 'user';

/**
 * A member of the community living on a municipality.
 * Stored at /municipalities/{municipalityId}/members/{userId}.
 */
export interface VillageMemberData {
  role: VillageMemberRole;
  joinedAt: Date;
  profileAnswers: ProfileAnswers;
  profileCompletedAt: Date | null;
  trustedNewsAuthor: boolean;
}

export interface VillageMemberDataInput {
  role?: VillageMemberRole;
  joinedAt?: Date;
  profileAnswers?: ProfileAnswers;
  profileCompletedAt?: Date | null;
  trustedNewsAuthor?: boolean;
}

export function buildVillageMemberData(input: VillageMemberDataInput = {}): VillageMemberData {
  return {
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
    profileAnswers: input.profileAnswers ?? {},
    profileCompletedAt: input.profileCompletedAt ?? null,
    trustedNewsAuthor: input.trustedNewsAuthor ?? false,
  };
}
