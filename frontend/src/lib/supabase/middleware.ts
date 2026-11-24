import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "../safeRedirect";

const PROTECTED = ["/dashboard", "/checkout", "/admin"];
/** Pages a signed-in visitor never needs: the website home and the auth forms. */
const SIGNED_OUT_PAGES = ["/", "/login", "/signup", "/admin/login"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const selectedPack = request.nextUrl.searchParams.get("buy");
  const pricingPurchase = Boolean(selectedPack && /^(starter|studio|showroom)$/.test(selectedPack));
  if (path === "/checkout" && pricingPurchase && !request.nextUrl.searchParams.has("pending")) {
    return NextResponse.redirect(new URL(`/landing?buy=${encodeURIComponent(selectedPack!)}#pricing`, request.url));
  }
  const protectedPage = path !== "/admin/login" && PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  // No Supabase session cookie = signed-out visitor: decide without a network call.
  // (Login and signup pages then open instantly instead of waiting on Auth.)
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) {
    if (protectedPage) return redirectToLogin(request, path);
    return NextResponse.next({ request });
  }

  // In-app navigations and prefetches (React Server Component requests) skip the
  // Auth round trip: the page was already authorised on load, the browser client
  // keeps the token fresh, and the API rejects expired tokens (-> redirect to login).
  if (request.headers.get("rsc") === "1" || request.headers.has("next-router-prefetch")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie if needed. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && protectedPage) return redirectToLogin(request, path);

  if (user && SIGNED_OUT_PAGES.includes(path) && !(path === "/" && pricingPurchase)) {
    const destination = path === "/admin/login" ? "/admin"
      : path === "/" ? "/dashboard" : safeNext(request.nextUrl.searchParams.get("next"));
    const url = new URL(destination, request.url);
    return NextResponse.redirect(url);
  }

  return response;
}

function redirectToLogin(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path === "/admin" || path.startsWith("/admin/") ? "/admin/login" : "/login";
  url.search = "";
  url.searchParams.set("next", path + request.nextUrl.search);
  return NextResponse.redirect(url);
}
