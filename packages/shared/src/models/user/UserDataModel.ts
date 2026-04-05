export interface UserData {
  displayName: string;
  email: string;
  birthday: Date;
  biography: string | null;
  telephone: string | null;
  photoURL: string | null;
  createdAt: Date;
}

export interface UserDataInput {
  displayName: string;
  email: string;
  birthday: Date;
  biography?: string | null;
  telephone?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    birthday: input.birthday,
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
