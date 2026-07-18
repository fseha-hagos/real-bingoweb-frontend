import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

/**
 * Explicit proxy for Better Auth so Set-Cookie reaches the browser on the
 * Next.js origin (localhost:3000). Rewrites alone are unreliable for cookies.
 */
async function proxy(req: NextRequest, pathSegments: string[]) {
  const backend = getBackendUrl().replace(/\/$/, "");
  const subPath = pathSegments.join("/");
  const url = new URL(req.url);
  const target = `${backend}/api/auth/${subPath}${url.search}`;

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

  // Forward all Set-Cookie headers (important for session)
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (getSetCookie && getSetCookie.length > 0) {
    for (const c of getSetCookie) {
      // Force cookie onto the frontend origin (drop Domain if backend set one)
      const cleaned = c
        .replace(/;\s*Domain=[^;]*/gi, "")
        .replace(/;\s*Secure/gi, "");
      resHeaders.append("set-cookie", cleaned);
    }
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) {
      resHeaders.append(
        "set-cookie",
        single.replace(/;\s*Domain=[^;]*/gi, "").replace(/;\s*Secure/gi, "")
      );
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
