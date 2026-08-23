/**
 * data-room/route.ts
 * GET — returns the locked 10-company Data Room roster with Profile/News docs
 * and public contacts (never exposes correct-contact / axis fields).
 */

import { NextResponse } from "next/server";
import { requireStudentApi } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";

export type DataRoomContact = {
  name: string;
  title: string;
  department: string;
};

export type DataRoomDocument = {
  type: "profile" | "news";
  title: string;
  content: string;
};

export type DataRoomCompany = {
  id: string;
  name: string;
  industry: string;
  sizeLabel: string;
  contacts: DataRoomContact[];
  documents: DataRoomDocument[];
};

/**
 * GET /api/student/data-room?attemptId=…
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireStudentApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const attemptId = new URL(request.url).searchParams.get("attemptId")?.trim();
    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, student_id, simulation_id")
      .eq("id", attemptId)
      .eq("student_id", auth.session.studentId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const simulationId = String(attempt.simulation_id);
    const { data: companies, error: companyError } = await supabase
      .from("crm_prospect_directory")
      .select("id, company_name, industry, size_locations")
      .eq("simulation_id", simulationId)
      .eq("in_data_room", true)
      .eq("is_active", true)
      .order("company_name", { ascending: true });

    if (companyError) {
      console.error("[data-room] companies", companyError);
      return NextResponse.json({ error: "Could not load Data Room." }, { status: 500 });
    }

    const rows = companies ?? [];
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No Data Room roster is configured for this simulation." },
        { status: 404 }
      );
    }

    const companyIds = rows.map((row) => String(row.id));

    const [{ data: contacts, error: contactsError }, { data: documents, error: docsError }] =
      await Promise.all([
        supabase
          .from("crm_prospect_contacts")
          .select("company_id, contact_name, contact_title, department")
          .in("company_id", companyIds),
        supabase
          .from("crm_prospect_documents")
          .select("company_id, doc_type, title, content")
          .in("company_id", companyIds),
      ]);

    if (contactsError) {
      console.error("[data-room] contacts", contactsError);
      return NextResponse.json({ error: "Could not load Data Room." }, { status: 500 });
    }
    if (docsError) {
      console.error("[data-room] documents", docsError);
      return NextResponse.json({ error: "Could not load Data Room." }, { status: 500 });
    }

    const contactsByCompany = new Map<string, DataRoomContact[]>();
    for (const contact of contacts ?? []) {
      const companyId = String(contact.company_id);
      const list = contactsByCompany.get(companyId) ?? [];
      list.push({
        name: String(contact.contact_name ?? ""),
        title: String(contact.contact_title ?? ""),
        department: String(contact.department ?? ""),
      });
      contactsByCompany.set(companyId, list);
    }
    contactsByCompany.forEach((list) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
    });

    const docsByCompany = new Map<string, DataRoomDocument[]>();
    for (const doc of documents ?? []) {
      const docType = doc.doc_type === "news" ? "news" : doc.doc_type === "profile" ? "profile" : null;
      if (!docType) {
        continue;
      }
      const companyId = String(doc.company_id);
      const list = docsByCompany.get(companyId) ?? [];
      list.push({
        type: docType,
        title: String(doc.title ?? ""),
        content: String(doc.content ?? ""),
      });
      docsByCompany.set(companyId, list);
    }
    docsByCompany.forEach((list) => {
      list.sort((a, b) => a.type.localeCompare(b.type));
    });

    const payload: DataRoomCompany[] = rows.map((row) => {
      const id = String(row.id);
      return {
        id,
        name: String(row.company_name ?? ""),
        industry: String(row.industry ?? ""),
        sizeLabel: String(row.size_locations ?? ""),
        contacts: contactsByCompany.get(id) ?? [],
        documents: docsByCompany.get(id) ?? [],
      };
    });

    return NextResponse.json({ companies: payload });
  } catch (err) {
    console.error("[data-room] unexpected", err);
    return NextResponse.json({ error: "Could not load Data Room." }, { status: 500 });
  }
}
