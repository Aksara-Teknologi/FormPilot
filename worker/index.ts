/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

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
