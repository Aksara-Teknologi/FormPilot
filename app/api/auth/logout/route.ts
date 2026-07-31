import { serializeCookie, SESSION_COOKIE } from "../../../../lib/auth";

export async function GET(request: Request) {
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/", request.url).toString(),
      "Cache-Control": "no-store",
    },
  });
  response.headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", request, 0));
  return response;
}
