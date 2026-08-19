import type { AppRole, User } from "@prisma/client";

export type JwtPayload = { sub: string; role: AppRole; sessionId: string };
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, "id" | "displayName" | "email" | "phone" | "username" | "role">;
};
