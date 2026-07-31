import { serializeCookie, SESSION_COOKIE } from "../../../../lib/auth";

export async function GET(request: Request) {
  const response = Response.redirect(new URL("/", request.url), 302);
  response.headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", request, 0));
  return response;
}
