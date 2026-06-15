"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyCredentials,
  createSessionToken,
  dashboardConfigured,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export type SignInState = { error?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!dashboardConfigured()) {
    return {
      error:
        "Dashboard login isn't set up yet. Add DASHBOARD_PASSWORD to your environment.",
    };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyCredentials(email, password)) {
    return { error: "Incorrect email or password." };
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const redirectTo = String(formData.get("redirect") ?? "/dashboard");
  redirect(redirectTo.startsWith("/dashboard") ? redirectTo : "/dashboard");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
