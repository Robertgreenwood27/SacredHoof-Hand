import "server-only";
import { cookies } from "next/headers";
import { isValidSessionToken, SESSION_COOKIE } from "./auth";

/** True if the current request carries a valid dashboard session cookie. */
export async function hasDashboardSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionToken(token);
}

/** Throw if the request isn't an authenticated practitioner. Use in actions. */
export async function requireDashboardSession(): Promise<void> {
  if (!(await hasDashboardSession())) {
    throw new Error("Not authorized. Please sign in again.");
  }
}
