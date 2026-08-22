/**
 * middleware.ts
 * Route protection for professors (Supabase auth)
 * and students (JWT cookie session).
 *
 * Public routes: /login, /register, /signup, /student-login, /student-register, /join/*
 * Professor routes: /teacher/* → requires Supabase session
 * Student routes: /student/* → requires student_session cookie
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_ROUTES, STUDENT_SESSION_COOKIE } from "@/lib/constants";
import { verifyStudentSessionToken } from "@/lib/student-session-crypto";

/**
 * Next.js middleware — dual auth gate for teacher and student routes.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/student/")) {
    const token = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/student-login", request.url));
    }
    const session = await verifyStudentSessionToken(token);
    if (!session) {
      return NextResponse.redirect(new URL("/student-login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/teacher/")) {
    let response = NextResponse.next({ request });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const supabase = createServerClient(url, key, {
      cookies: {
        get(name: string): string | undefined {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>): void {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>): void {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Redirect authenticated professors away from login/register pages
  const isAuthPage =
    PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (isAuthPage) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      let response = NextResponse.next({ request });
      const supabase = createServerClient(url, key, {
        cookies: {
          get(name: string): string | undefined {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>): void {
            response = NextResponse.next({ request });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>): void {
            response = NextResponse.next({ request });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (
        user &&
        (pathname === "/login" || pathname === "/register" || pathname === "/signup")
      ) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "teacher") {
          return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
        }
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/login", "/register", "/signup"],
};
