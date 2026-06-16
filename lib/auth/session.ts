import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { Role } from "@prisma/client";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireAuth();
  const roleHierarchy = {
    [Role.EMPLOYEE]: 0,
    [Role.MANAGER]: 1,
    [Role.ADMIN]: 2,
  };
  if (roleHierarchy[user.role as Role] < roleHierarchy[role]) {
    throw new Error("Forbidden");
  }
  return user;
}
