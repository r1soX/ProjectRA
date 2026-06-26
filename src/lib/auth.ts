import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "./session";

export type SessionUser = {
  id: string;
  username: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  role: string;
  avatar: string | null;
  avatarEmoji: string | null;
};

export async function setSessionCookie(userId: string) {
  const token = await signSession(userId);
  // Only mark the cookie Secure when actually served over HTTPS — otherwise a
  // self-hosted HTTP deployment (LAN/IP) would silently drop the cookie.
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  const isHttps = proto.split(",")[0].trim() === "https";
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Returns the current user (validated against DB), or null. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      username: true,
      lastName: true,
      firstName: true,
      middleName: true,
      role: true,
      avatar: true,
      avatarEmoji: true,
      isActive: true,
    },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
    role: user.role,
    avatar: user.avatar,
    avatarEmoji: user.avatarEmoji,
  };
}

/** Redirects to /login when not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Redirects non-admins to /dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
