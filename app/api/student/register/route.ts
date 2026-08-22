/**
 * register/route.ts
 * POST /api/student/register — create student account; class join code is optional.
 */

import { NextResponse } from "next/server";
import {
  DEFAULT_CLASS_JOIN_CODE,
  JOIN_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
} from "@/lib/constants";
import { hashPassword } from "@/lib/password";
import { enrollStudentInClass, enrollStudentInDefaultClass } from "@/lib/student-enrollment";
import { createStudentSession } from "@/lib/student-session";
import { createServiceClient } from "@/lib/supabase/server";

type RegisterBody = {
  username?: string;
  displayName?: string;
  password?: string;
  joinCode?: string;
};

/**
 * Creates a globally unique student account and enrolls them in the default class.
 * When a valid join code is provided, also enrolls in that professor class.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as RegisterBody;
    const username = body.username?.trim() ?? "";
    const displayName = body.displayName?.trim() ?? "";
    const password = body.password ?? "";
    const joinCode = body.joinCode?.trim().toUpperCase() ?? "";

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !USERNAME_REGEX.test(username)
    ) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters (letters, numbers, underscores only)." },
        { status: 400 }
      );
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Optional professor-class enrollment — only when a code is provided.
    let professorClass: { id: string; professor_id: string | null } | null = null;
    if (joinCode.length > 0) {
      if (joinCode === DEFAULT_CLASS_JOIN_CODE) {
        return NextResponse.json({ error: "Invalid class code." }, { status: 404 });
      }

      if (joinCode.length !== JOIN_CODE_LENGTH) {
        return NextResponse.json({ error: "Invalid class code." }, { status: 400 });
      }

      const { data: classRow, error: classError } = await supabase
        .from("classes")
        .select("id, professor_id, is_active")
        .eq("join_code", joinCode)
        .single();

      if (classError || !classRow) {
        return NextResponse.json(
          { error: "Class not found. Check your class code." },
          { status: 404 }
        );
      }

      if (!classRow.is_active) {
        return NextResponse.json(
          { error: "This class is not accepting new students." },
          { status: 403 }
        );
      }

      professorClass = {
        id: classRow.id as string,
        professor_id: classRow.professor_id as string | null,
      };
    }

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Username already taken. Please choose another." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data: student, error: insertError } = await supabase
      .from("students")
      .insert({
        username,
        display_name: displayName,
        password_hash: passwordHash,
      })
      .select("id")
      .single();

    if (insertError || !student) {
      return NextResponse.json(
        { error: "Could not create account. Please try again." },
        { status: 500 }
      );
    }

    if (professorClass) {
      const enrollResult = await enrollStudentInClass(supabase, {
        studentId: student.id,
        classId: professorClass.id,
        professorId: professorClass.professor_id,
      });

      if (!enrollResult.ok) {
        await supabase.from("students").delete().eq("id", student.id);
        return NextResponse.json(
          { error: enrollResult.message },
          { status: enrollResult.status }
        );
      }
    }

    await enrollStudentInDefaultClass(supabase, student.id);

    await createStudentSession({
      studentId: student.id,
      username,
      displayName,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
