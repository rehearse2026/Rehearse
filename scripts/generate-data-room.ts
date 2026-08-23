/**
 * generate-data-room.ts
 * One-time seeder: locks a 10-company Data Room roster from the existing
 * prospect-directory pool and AI-authors Profile + News documents per company.
 * Runnable via: npx tsx scripts/generate-data-room.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { TEMPO_SIMULATION_ID } from "../lib/constants";

// ── Types ────────────────────────────────────────────────────────────────────

type EntryType = "target" | "crafted_decoy" | "filler";
type DocType = "profile" | "news";

type DirectoryCompany = {
  id: string;
  company_name: string;
  industry: string;
  size_locations: string;
  signal_hint: string;
  hidden_claim: string | null;
  entry_type: EntryType;
  in_data_room: boolean;
};

type ContactRow = {
  contact_name: string;
  contact_title: string;
  department: string;
};

type DocumentRow = {
  company_id: string;
  doc_type: DocType;
};

type GenerationReport = {
  rosterSelected: boolean;
  rosterCompanies: Array<{ id: string; company_name: string; entry_type: EntryType }>;
  documentsCreated: number;
  documentsSkipped: number;
  missingDocuments: Array<{ company_name: string; missing: DocType[] }>;
  failures: string[];
};

// ── Env + clients ────────────────────────────────────────────────────────────

/**
 * Loads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY
 * from .env.local when unset (same pattern as generate-prospect-directory.ts).
 */
function loadEnvLocalIfNeeded(): void {
  const needed = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
  ] as const;
  if (needed.every((key) => Boolean(process.env[key]))) {
    return;
  }
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* optional */
  }
}

/**
 * Picks `count` random items without mutating the source array.
 */
function pickRandomSubset<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}

// ── PART 1: Roster selection ─────────────────────────────────────────────────

/**
 * Ensures exactly 10 companies are flagged in_data_room for the simulation.
 * Idempotent: if any row is already flagged, leaves the roster unchanged.
 */
async function selectDataRoomRoster(
  supabase: SupabaseClient,
  simulationId: string
): Promise<{
  selectedNow: boolean;
  companies: DirectoryCompany[];
}> {
  const { data: existingRoster, error: existingError } = await supabase
    .from("crm_prospect_directory")
    .select(
      "id, company_name, industry, size_locations, signal_hint, hidden_claim, entry_type, in_data_room"
    )
    .eq("simulation_id", simulationId)
    .eq("in_data_room", true)
    .eq("is_active", true);

  if (existingError) {
    if (
      existingError.message.includes("in_data_room") ||
      existingError.code === "42703" ||
      existingError.code === "PGRST204"
    ) {
      throw new Error(
        "Missing schema: crm_prospect_directory.in_data_room. " +
          "Run supabase/crm-data-room-migration.sql in the Supabase SQL editor first."
      );
    }
    throw new Error(`Could not check Data Room roster: ${existingError.message}`);
  }

  if ((existingRoster ?? []).length > 0) {
    console.log("Data Room roster already selected, skipping");
    return {
      selectedNow: false,
      companies: (existingRoster ?? []) as DirectoryCompany[],
    };
  }

  const { data: pool, error: poolError } = await supabase
    .from("crm_prospect_directory")
    .select(
      "id, company_name, industry, size_locations, signal_hint, hidden_claim, entry_type, in_data_room"
    )
    .eq("simulation_id", simulationId)
    .eq("is_active", true);

  if (poolError || !pool) {
    throw new Error(
      `Could not load prospect directory pool: ${poolError?.message ?? "unknown"}`
    );
  }

  const companies = pool as DirectoryCompany[];
  const target = companies.filter((row) => row.entry_type === "target");
  const decoys = companies.filter((row) => row.entry_type === "crafted_decoy");
  const fillers = companies.filter((row) => row.entry_type === "filler");

  if (target.length !== 1) {
    throw new Error(`Expected exactly 1 target, found ${target.length}.`);
  }
  if (decoys.length !== 3) {
    throw new Error(`Expected exactly 3 crafted_decoy rows, found ${decoys.length}.`);
  }
  if (fillers.length < 6) {
    throw new Error(`Need at least 6 fillers, found ${fillers.length}.`);
  }

  const selectedFillers = pickRandomSubset(fillers, 6);
  const roster = [...target, ...decoys, ...selectedFillers];
  const rosterIds = roster.map((row) => row.id);

  const { error: updateError } = await supabase
    .from("crm_prospect_directory")
    .update({ in_data_room: true })
    .in("id", rosterIds);

  if (updateError) {
    throw new Error(`Could not lock Data Room roster: ${updateError.message}`);
  }

  console.log(`Locked Data Room roster (${roster.length} companies).`);
  for (const row of roster) {
    console.log(`  - [${row.entry_type}] ${row.company_name}`);
  }

  return { selectedNow: true, companies: roster };
}

// ── PART 2: Document generation ──────────────────────────────────────────────

/**
 * Loads the three contacts for a company (name/title/department).
 */
async function loadCompanyContacts(
  supabase: SupabaseClient,
  companyId: string
): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("crm_prospect_contacts")
    .select("contact_name, contact_title, department")
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Could not load contacts for ${companyId}: ${error.message}`);
  }

  return (data ?? []) as ContactRow[];
}

/**
 * Returns which doc types already exist for a company.
 */
async function loadExistingDocTypes(
  supabase: SupabaseClient,
  companyId: string
): Promise<Set<DocType>> {
  const { data, error } = await supabase
    .from("crm_prospect_documents")
    .select("company_id, doc_type")
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Could not load documents for ${companyId}: ${error.message}`);
  }

  const types = new Set<DocType>();
  for (const row of (data ?? []) as DocumentRow[]) {
    if (row.doc_type === "profile" || row.doc_type === "news") {
      types.add(row.doc_type);
    }
  }
  return types;
}

/**
 * Builds the Profile document system prompt from company + contacts.
 */
function buildProfileSystemPrompt(
  company: DirectoryCompany,
  contacts: ContactRow[]
): string {
  const contactList =
    contacts.length > 0
      ? contacts
          .map((c) => `${c.contact_name} (${c.contact_title})`)
          .join(", ")
      : "none listed";

  return (
    `Write a short, factual company profile (150-250 words) for ${company.company_name}, ` +
    `a ${company.industry} business with ${company.size_locations}. ` +
    `Include a brief 'Team' section listing these contacts by name and title: ${contactList}. ` +
    `Write plain, professional prose — no bullet lists, no marketing language, no opinions ` +
    `about whether this is a good business opportunity. Do not mention or imply anything ` +
    `about how this company compares to any other company.`
  );
}

/**
 * Builds the News document system prompt from signal_hint and optional hidden_claim.
 */
function buildNewsSystemPrompt(company: DirectoryCompany): string {
  const hidden = company.hidden_claim?.trim() ?? "";
  const hiddenInstruction = hidden
    ? ` If provided, also naturally incorporate this additional detail, but hedge it clearly as unconfirmed/reported rather than a confirmed fact: ${hidden}.`
    : "";

  return (
    `Write a short, local-news-style item (100-200 words) about ${company.company_name}, ` +
    `incorporating this real detail: ${company.signal_hint}.${hiddenInstruction} ` +
    `Write like a real local business news item, not a data summary. Do not state or imply ` +
    `whether this is a good prospect for any particular vendor.`
  );
}

/**
 * Calls OpenAI once and returns the generated document body.
 */
async function generateDocumentContent(
  openai: OpenAI,
  systemPrompt: string
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 700,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "Write the document now. Return only the prose body, no title line.",
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI returned empty content.");
  }
  return text;
}

/**
 * Inserts one document row; does not overwrite existing rows.
 */
async function insertDocument(
  supabase: SupabaseClient,
  companyId: string,
  docType: DocType,
  title: string,
  content: string
): Promise<void> {
  const { error } = await supabase.from("crm_prospect_documents").insert({
    company_id: companyId,
    doc_type: docType,
    title,
    content,
  });
  if (error) {
    throw new Error(`Insert ${docType} failed: ${error.message}`);
  }
}

/**
 * Generates missing Profile/News documents for every in_data_room company.
 * Skips companies that already have both docs; never overwrites.
 */
async function generateDataRoomDocuments(
  supabase: SupabaseClient,
  openai: OpenAI,
  companies: DirectoryCompany[]
): Promise<{
  created: number;
  skipped: number;
  missingDocuments: Array<{ company_name: string; missing: DocType[] }>;
  failures: string[];
}> {
  let created = 0;
  let skipped = 0;
  const missingDocuments: Array<{ company_name: string; missing: DocType[] }> = [];
  const failures: string[] = [];

  for (const company of companies) {
    try {
      const existing = await loadExistingDocTypes(supabase, company.id);
      if (existing.has("profile") && existing.has("news")) {
        console.log(`  skip ${company.company_name} (documents already locked)`);
        skipped += 1;
        continue;
      }

      const contacts = await loadCompanyContacts(supabase, company.id);
      const needed: DocType[] = (["profile", "news"] as const).filter(
        (t) => !existing.has(t)
      );

      for (const docType of needed) {
        try {
          const systemPrompt =
            docType === "profile"
              ? buildProfileSystemPrompt(company, contacts)
              : buildNewsSystemPrompt(company);
          const content = await generateDocumentContent(openai, systemPrompt);
          const title =
            docType === "profile"
              ? `${company.company_name} — Company Profile`
              : `${company.company_name} — Recent News`;
          await insertDocument(supabase, company.id, docType, title, content);
          created += 1;
          console.log(`  wrote ${docType} for ${company.company_name}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const line = `${company.company_name} [${docType}]: ${message}`;
          failures.push(line);
          console.error(`  ERROR ${line}`);
        }
      }

      const after = await loadExistingDocTypes(supabase, company.id);
      const stillMissing = (["profile", "news"] as const).filter((t) => !after.has(t));
      if (stillMissing.length > 0) {
        missingDocuments.push({
          company_name: company.company_name,
          missing: [...stillMissing],
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const line = `${company.company_name}: ${message}`;
      failures.push(line);
      console.error(`  ERROR ${line}`);
      missingDocuments.push({
        company_name: company.company_name,
        missing: ["profile", "news"],
      });
    }
  }

  return { created, skipped, missingDocuments, failures };
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Runs roster selection then document generation for one simulation.
 */
export async function generateDataRoom(
  supabase: SupabaseClient,
  openai: OpenAI,
  simulationId: string = TEMPO_SIMULATION_ID
): Promise<GenerationReport> {
  const { selectedNow, companies } = await selectDataRoomRoster(supabase, simulationId);

  if (companies.length === 0) {
    throw new Error("No Data Room companies available after roster selection.");
  }

  console.log(`Generating documents for ${companies.length} roster companies…`);
  const docs = await generateDataRoomDocuments(supabase, openai, companies);

  return {
    rosterSelected: selectedNow,
    rosterCompanies: companies.map((c) => ({
      id: c.id,
      company_name: c.company_name,
      entry_type: c.entry_type,
    })),
    documentsCreated: docs.created,
    documentsSkipped: docs.skipped,
    missingDocuments: docs.missingDocuments,
    failures: docs.failures,
  };
}

/**
 * CLI entry — Tempo simulation Data Room seed.
 */
async function runCli(): Promise<void> {
  loadEnvLocalIfNeeded();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!openaiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const supabase = createClient(url, key);
  const openai = new OpenAI({ apiKey: openaiKey });
  const report = await generateDataRoom(supabase, openai, TEMPO_SIMULATION_ID);

  console.log("\n── Summary ──");
  console.log(
    report.rosterSelected
      ? "Roster: newly selected this run"
      : "Roster: already locked (unchanged)"
  );
  console.log(`Roster size: ${report.rosterCompanies.length}`);
  for (const row of report.rosterCompanies) {
    console.log(`  [${row.entry_type}] ${row.company_name}`);
  }
  console.log(`Documents created: ${report.documentsCreated}`);
  console.log(`Companies skipped (docs already locked): ${report.documentsSkipped}`);
  if (report.missingDocuments.length > 0) {
    console.log("Companies still missing documents:");
    for (const miss of report.missingDocuments) {
      console.log(`  - ${miss.company_name}: ${miss.missing.join(", ")}`);
    }
  } else {
    console.log("All roster companies have both profile and news documents.");
  }
  if (report.failures.length > 0) {
    console.log("Failures:");
    for (const failure of report.failures) {
      console.log(`  - ${failure}`);
    }
    process.exitCode = 1;
  }
}

const isMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isMain) {
  runCli().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
