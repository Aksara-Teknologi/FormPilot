/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
        return new Response("Google SSO belum dikonfigurasi untuk environment ini.", { status: 503 });
      }
      const token = request.headers.get("cf-access-jwt-assertion");
      if (!token) return new Response("Unauthorized", { status: 401 });
      try {
        const jwks = createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN.replace(/\/$/, "")}/cdn-cgi/access/certs`));
        const { payload } = await jwtVerify(token, jwks, { issuer: env.TEAM_DOMAIN, audience: env.POLICY_AUD });
        const requestHeaders = new Headers(request.headers);
        requestHeaders.delete("cf-access-authenticated-user-email");
        if (typeof payload.email === "string") requestHeaders.set("cf-access-authenticated-user-email", payload.email);
        request = new Request(request, { headers: requestHeaders });
      } catch (error) {
        console.warn(JSON.stringify({ message: "access_jwt_rejected", path: url.pathname, reason: error instanceof Error ? error.name : "unknown" }));
        return new Response("Unauthorized", { status: 401 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const secureResponse = new Response(response.body, response);
    secureResponse.headers.set("X-Content-Type-Options", "nosniff");
    secureResponse.headers.set("X-Frame-Options", "DENY");
    secureResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    secureResponse.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    secureResponse.headers.set("X-Permitted-Cross-Domain-Policies", "none");
    secureResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    secureResponse.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (url.protocol === "https:") secureResponse.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    return secureResponse;
  },
};

export default worker;
