/**
 * crm-leads/[leadId]/route.ts
 * PATCH — update a Lead still in status "new" or "shortlisted".
 * DELETE — remove a Lead still in status "new" or "shortlisted".
 */

import { NextResponse } from "next/server";
import { requireStudentApi } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { CrmLead } from "@/types";

type PatchLeadBody = {
  companyName?: string;
  contactName?: string;
  contactTitle?: string;
  whyFit?: string;
  trigger?: string;
  nextStep?: string;
  decisionMakerRationale?: string;
};

type RouteContext = {
  params: { leadId: string };
};

const LEAD_SELECT_COLUMNS =
  "id, attempt_id, company_name, contact_name, contact_title, why_fit, trigger_event, next_step, decision_maker_rationale, status, created_at, updated_at";

/**
 * Maps a crm_leads row to the API CrmLead shape.
 */
function mapLeadRow(row: Record<string, unknown>): CrmLead {
  const statusRaw = String(row.status ?? "new");
  const status: CrmLead["status"] =
    statusRaw === "converted"
      ? "converted"
      : statusRaw === "selected"
        ? "selected"
        : statusRaw === "shortlisted"
          ? "shortlisted"
          : "new";

  return {
    id: String(row.id),
    attempt_id: String(row.attempt_id),
    company_name: String(row.company_name ?? ""),
    contact_name: String(row.contact_name ?? ""),
    contact_title: String(row.contact_title ?? ""),
    why_fit: String(row.why_fit ?? ""),
    trigger_event: String(row.trigger_event ?? ""),
    next_step: String(row.next_step ?? ""),
    decision_maker_rationale: String(row.decision_maker_rationale ?? ""),
    status,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/**
 * True when the lead can still be edited or removed from the shortlist flow.
 */
function isMutableLeadStatus(status: unknown): boolean {
  return status === "new" || status === "shortlisted";
}

/**
 * PATCH — update editable fields on a mutable Lead owned by the student.
 */
export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await requireStudentApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const leadId = context.params.leadId?.trim();
    if (!leadId) {
      return NextResponse.json({ error: "Missing leadId." }, { status: 400 });
    }

    const body = (await request.json()) as PatchLeadBody;
    const supabase = createServiceClient();

    const { data: existing, error: loadError } = await supabase
      .from("crm_leads")
      .select(LEAD_SELECT_COLUMNS)
      .eq("id", leadId)
      .maybeSingle();

    if (loadError) {
      console.error("[crm-leads] PATCH load failed:", loadError);
      return NextResponse.json({ error: "Could not update CRM lead." }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const { data: attempt } = await supabase
      .from("attempts")
      .select("id")
      .eq("id", existing.attempt_id as string)
      .eq("student_id", auth.session.studentId)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    if (!isMutableLeadStatus(existing.status)) {
      return NextResponse.json(
        { error: "Selected or converted leads cannot be edited." },
        { status: 400 }
      );
    }

    const patch: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.companyName === "string") {
      patch.company_name = body.companyName.trim();
    }
    if (typeof body.contactName === "string") {
      patch.contact_name = body.contactName.trim();
    }
    if (typeof body.contactTitle === "string") {
      patch.contact_title = body.contactTitle.trim();
    }
    if (typeof body.whyFit === "string") {
      patch.why_fit = body.whyFit.trim();
    }
    if (typeof body.trigger === "string") {
      patch.trigger_event = body.trigger.trim();
    }
    if (typeof body.nextStep === "string") {
      patch.next_step = body.nextStep.trim();
    }
    if (typeof body.decisionMakerRationale === "string") {
      patch.decision_maker_rationale = body.decisionMakerRationale.trim();
    }

    const { data, error } = await supabase
      .from("crm_leads")
      .update(patch)
      .eq("id", leadId)
      .select(LEAD_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      console.error("[crm-leads] PATCH failed:", error);
      return NextResponse.json({ error: "Could not update CRM lead." }, { status: 500 });
    }

    return NextResponse.json({ lead: mapLeadRow(data as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ error: "Could not update CRM lead." }, { status: 500 });
  }
}

/**
 * DELETE — remove a mutable Lead (used to free a shortlist slot).
 */
export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await requireStudentApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const leadId = context.params.leadId?.trim();
    if (!leadId) {
      return NextResponse.json({ error: "Missing leadId." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing, error: loadError } = await supabase
      .from("crm_leads")
      .select("id, attempt_id, status")
      .eq("id", leadId)
      .maybeSingle();

    if (loadError) {
      console.error("[crm-leads] DELETE load failed:", loadError);
      return NextResponse.json({ error: "Could not remove CRM lead." }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const { data: attempt } = await supabase
      .from("attempts")
      .select("id")
      .eq("id", existing.attempt_id as string)
      .eq("student_id", auth.session.studentId)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    if (!isMutableLeadStatus(existing.status)) {
      return NextResponse.json(
        { error: "Selected or converted leads cannot be removed." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase.from("crm_leads").delete().eq("id", leadId);
    if (deleteError) {
      console.error("[crm-leads] DELETE failed:", deleteError);
      return NextResponse.json({ error: "Could not remove CRM lead." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not remove CRM lead." }, { status: 500 });
  }
}
