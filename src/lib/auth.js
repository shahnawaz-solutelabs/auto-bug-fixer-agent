import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../app/api/auth/[...nextauth]/route.js";

export async function getAuthSession() {
  return getServerSession(getAuthOptions());
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}
