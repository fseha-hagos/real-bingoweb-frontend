import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://real-bingoweb-backend.onrender.com"
  );
}

/**
 * Rewrite upstream Set-Cookie onto the Next.js frontend origin.
 * - Drop Domain so the cookie binds to vercel.app / localhost
 * - Keep Secure on HTTPS (Vercel); strip Secure (+ __Secure-/__Host- prefix) on HTTP
 */
function rewriteSetCookie(cookie: string, isHttps: boolean): string {
  let cleaned = cookie.replace(/;\s*Domain=[^;]*/gi, "");

  if (isHttps) {
    if (!/;\s*Secure\b/i.test(cleaned)) {
      cleaned += "; Secure";
    }
  } else {
    cleaned = cleaned
      .replace(/^(__Secure-|__Host-)/i, "")
      .replace(/;\s*Secure\b/gi, "");
  }

  return cleaned;
}

/**
 * Explicit proxy for Better Auth so Set-Cookie reaches the browser on the
 * Next.js origin. Rewrites alone are unreliable for cookies.
 */
async function proxy(req: NextRequest, pathSegments: string[]) {
  const backend = getBackendUrl().replace(/\/$/, "");
  const subPath = pathSegments.join("/");
  const url = new URL(req.url);
  const target = `${backend}/api/auth/${subPath}${url.search}`;
  const isHttps = url.protocol === "https:";

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const origin = req.headers.get("origin") || url.origin;
  headers.set("origin", origin);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();

  const resHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) resHeaders.set("content-type", upstreamType);

  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  if (getSetCookie && getSetCookie.length > 0) {
    for (const c of getSetCookie) {
      resHeaders.append("set-cookie", rewriteSetCookie(c, isHttps));
    }
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) {
      resHeaders.append("set-cookie", rewriteSetCookie(single, isHttps));
    }
  }

  return new NextResponse(body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ all: string[] }> }
) {
  const { all } = await ctx.params;
  return proxy(req, all);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ all: string[] }> }
) {
  const { all } = await ctx.params;
  return proxy(req, all);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ all: string[] }> }
) {
  const { all } = await ctx.params;
  return proxy(req, all);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ all: string[] }> }
) {
  const { all } = await ctx.params;
  return proxy(req, all);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ all: string[] }> }
) {
  const { all } = await ctx.params;
  return proxy(req, all);
}
