export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: Date;
}
