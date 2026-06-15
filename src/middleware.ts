import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

/** Guards /dashboard behind the practitioner session cookie. */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!(await isValidSessionToken(token))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
