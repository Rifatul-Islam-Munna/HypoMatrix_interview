export type AuthenticatedUser = {
  id: string;
  username: string;
};

export type SessionValue = AuthenticatedUser & {
  createdAt: string;
};
