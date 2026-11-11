import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://real-bingoweb-backend.onrender.com"
  ).replace(/\/$/, "");
}

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
 * Proxy /api/* (except /api/auth/* which has its own handler) to the Express backend.
 * Next.js rewrites were forwarding the literal path "/api/$1" for some methods.
 */
async function proxy(req: NextRequest, pathSegments: string[]) {
  try {
    const subPath = pathSegments.join("/");
    // Auth has a dedicated cookie-safe proxy
    if (subPath === "auth" || subPath.startsWith("auth/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const target = `${getBackendUrl()}/api/${subPath}${url.search}`;
    const isHttps = url.protocol === "https:";

    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const cookie = req.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers.set("authorization", authHeader);
    const tgData = req.headers.get("x-telegram-init-data");
    if (tgData) headers.set("x-telegram-init-data", tgData);
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
  } catch (err: any) {
    console.error("Proxy error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Proxy error", stack: err?.stack },
      { status: 500 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
