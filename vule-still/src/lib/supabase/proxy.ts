import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnvironment } from "./environment";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabaseEnvironment();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        const previousCookies = response.cookies.getAll();
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const cookie of previousCookies) {
          response.cookies.set(cookie);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // The SDK sends cache headers on its first write only. Preserve them
        // and earlier cookies if a later write rebuilds this response.
        Object.assign(cacheHeaders, headers);
        for (const [name, value] of Object.entries(cacheHeaders)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Validate/refresh the session immediately after creating the client.
  // This is refresh plumbing, not route authorization or the 30-day rule.
  await supabase.auth.getClaims();
  return response;
}
