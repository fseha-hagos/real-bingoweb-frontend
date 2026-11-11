import { NextRequest, NextResponse } from "next/server";

// Guests can browse the live lobby; play/wallet/profile still require auth
const PUBLIC_PATHS = new Set(["/", "/login"]);

const APP_PATHS = new Set([
  "/",
  "/cards",
  "/game",
  "/leaderboard",
  "/wallet",
  "/profile",
  "/login",
  "/debug-anim",
]);

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("bingo.session_token") ||
    request.cookies.get("__Secure-bingo.session_token") ||
    request.cookies.get("better-auth.session_token");

  if (!sessionCookie && !PUBLIC_PATHS.has(pathname) && APP_PATHS.has(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (sessionCookie && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (APP_PATHS.has(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
