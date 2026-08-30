/**
 * tempo-prospect-directory.ts
 * Seed data + helpers for the Prospecting company directory and scoped research chat.
 * Source of truth when crm_prospect_directory is empty or unavailable.
 */

import type { ChatMessage } from "@/types";

/** One named person at a directory company (no correct/trap flag — never sent to clients). */
export type ProspectDirectoryContact = {
  name: string;
  title: string;
  department: string;
};

/** Full directory row including server-only answer-key fields. */
export type ProspectDirectoryCompanyRow = {
  id: string;
  name: string;
  industry: string;
  sizeLabel: string;
  signalHint: string;
  /** Server-only scripted research claim; stripped by toPublicProspectCompany(). */
  hiddenClaim?: string | null;
  contacts?: ProspectDirectoryContact[];
  /** Server-only legacy target flag; stripped by toPublicProspectCompany(). */
  isTarget: boolean;
  vertical?: string;
  locations?: number;
  metro?: string;
  inTerritory?: boolean;
  sizeNote?: string;
  onlineBooking?: boolean;
  blurb?: string;
  publicSignals?: string[];
  researchFacts?: string[];
  class?: string;
  subtype?: string | null;
  fitRank?: number | null;
  triggerQuality?: string;
  keyedTrigger?: string | null;
  bestContact?: string | null;
  why?: string | null;
  entryType?: string;
};

/** Public company card shape returned by the directory API (visible layer only). */
export type ProspectDirectoryCompany = {
  id: string;
  name: string;
  industry: string;
  sizeLabel: string;
  signalHint: string;
  contacts: ProspectDirectoryContact[];
  vertical?: string;
  locations?: number;
  metro?: string;
  inTerritory?: boolean;
  sizeNote?: string;
  onlineBooking?: boolean;
  blurb?: string;
  publicSignals?: string[];
};

/** Allowed top-level keys on the public prospect company payload. */
export const PUBLIC_PROSPECT_COMPANY_KEYS = [
  "id",
  "name",
  "industry",
  "sizeLabel",
  "signalHint",
  "contacts",
  "vertical",
  "locations",
  "metro",
  "inTerritory",
  "sizeNote",
  "onlineBooking",
  "blurb",
  "publicSignals",
] as const;

/** Hidden server-only field names that must never appear on public payloads. */
export const HIDDEN_PROSPECT_DIRECTORY_FIELD_NAMES = [
  "researchFacts",
  "research_facts",
  "class",
  "subtype",
  "fitRank",
  "fit_rank",
  "triggerQuality",
  "trigger_quality",
  "keyedTrigger",
  "keyed_trigger",
  "bestContact",
  "best_contact",
  "why",
  "hiddenClaim",
  "hidden_claim",
  "entryType",
  "entry_type",
  "isTarget",
  "signal_hint",
] as const;

/** Show every non-target company in the 25-company Tempo directory. */
export const PROSPECT_DIRECTORY_DECOY_COUNT = 24;

/**
 * Stable seeded companies: 1 Tempo target + dental/vet/PT/optometry/med spa/chiro decoys.
 * UUIDs are fixed so attempt-cached id lists stay valid across reloads.
 */
export const PROSPECT_DIRECTORY_SEED: readonly ProspectDirectoryCompanyRow[] = [
  {
    id: "a1000001-0001-4000-8000-000000000001",
    name: "Summit Dental Group",
    industry: "Dental",
    sizeLabel: "8 locations",
    signalHint: "Just opened 8th Front Range location; phone scheduling under strain.",
    isTarget: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000002",
    name: "Bright Smile Dental",
    industry: "Dental",
    sizeLabel: "3 locations",
    signalHint: "Posting about front-desk overtime after evening hygiene blocks.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000003",
    name: "Main Street Dental",
    industry: "Dental",
    sizeLabel: "1 location",
    signalHint: "Hiring a second receptionist; mentions missed after-hours calls.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000004",
    name: "Apex Dental Arts",
    industry: "Dental",
    sizeLabel: "2 locations",
    signalHint: "Updating patient portal; looking to reduce no-shows.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000005",
    name: "Urban Orthodontics",
    industry: "Dental",
    sizeLabel: "4 locations",
    signalHint: "Expanding aligner consults; calendar double-books on consult days.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000006",
    name: "Paws & Whiskers Veterinary",
    industry: "Veterinary",
    sizeLabel: "2 clinics",
    signalHint: "Weekend emergency overflow and high same-day cancel rate.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000007",
    name: "Riverbend Animal Hospital",
    industry: "Veterinary",
    sizeLabel: "1 clinic",
    signalHint: "New associate onboarded; phone line busy during lunch rush.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000008",
    name: "Summit Peak Physical Therapy",
    industry: "Physical Therapy",
    sizeLabel: "5 clinics",
    signalHint: "Opening fifth clinic; therapists lose time to rescheduling calls.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-000000000009",
    name: "Cascade Rehab Partners",
    industry: "Physical Therapy",
    sizeLabel: "3 clinics",
    signalHint: "Insurance auth delays causing last-minute cancellations.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000a",
    name: "ClearView Optometry",
    industry: "Optometry",
    sizeLabel: "2 locations",
    signalHint: "Contact-lens reorder reminders still manual via spreadsheet.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000b",
    name: "Lumen Eye Care",
    industry: "Optometry",
    sizeLabel: "4 locations",
    signalHint: "Adding Saturday hours; online booking often double-books slots.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000c",
    name: "Glow Med Spa Denver",
    industry: "Med Spa",
    sizeLabel: "2 studios",
    signalHint: "Injectables waitlist growing; no-shows on first consults.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000d",
    name: "Aurora Wellness Spa",
    industry: "Med Spa",
    sizeLabel: "1 studio",
    signalHint: "Launching membership packages; tracking renewals in email.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000e",
    name: "SpineAlign Chiropractic",
    industry: "Chiropractic",
    sizeLabel: "3 clinics",
    signalHint: "Care-plan adherence dropping after visit three.",
    isTarget: false,
  },
  {
    id: "a1000001-0001-4000-8000-00000000000f",
    name: "TrueNorth Chiro Group",
    industry: "Chiropractic",
    sizeLabel: "6 clinics",
    signalHint: "Multi-clinic schedule conflicts when DCs cover for each other.",
    isTarget: false,
  },
] as const;

/**
 * Strips server-only answer-key fields before returning companies to the client.
 */
export function toPublicProspectCompany(
  row: ProspectDirectoryCompanyRow
): ProspectDirectoryCompany {
  const payload: ProspectDirectoryCompany = {
    id: row.id,
    name: row.name,
    industry: row.industry,
    sizeLabel: row.sizeLabel,
    signalHint: row.signalHint,
    contacts: row.contacts ?? [],
  };

  if (row.vertical !== undefined) {
    payload.vertical = row.vertical;
  }
  if (row.locations !== undefined) {
    payload.locations = row.locations;
  }
  if (row.metro !== undefined) {
    payload.metro = row.metro;
  }
  if (row.inTerritory !== undefined) {
    payload.inTerritory = row.inTerritory;
  }
  if (row.sizeNote !== undefined) {
    payload.sizeNote = row.sizeNote;
  }
  if (row.onlineBooking !== undefined) {
    payload.onlineBooking = row.onlineBooking;
  }
  if (row.blurb !== undefined) {
    payload.blurb = row.blurb;
  }
  if (row.publicSignals !== undefined) {
    payload.publicSignals = row.publicSignals;
  }

  return payload;
}

/**
 * Throws when a public payload includes keys outside the visible-layer allowlist.
 */
export function assertNoHiddenFieldsInPublicPayload(payload: ProspectDirectoryCompany): void {
  const allowed = new Set<string>(PUBLIC_PROSPECT_COMPANY_KEYS);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Error(`Public payload contains disallowed key: ${key}`);
    }
  }

  for (const hidden of HIDDEN_PROSPECT_DIRECTORY_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(payload, hidden)) {
      throw new Error(`Public payload leaked hidden field: ${hidden}`);
    }
  }

  for (const contact of payload.contacts) {
    for (const key of Object.keys(contact)) {
      if (!["name", "title", "department"].includes(key)) {
        throw new Error(`Public contact payload leaked field: ${key}`);
      }
    }
  }
}

/**
 * Fisher–Yates shuffle (in-place copy).
 */
export function shuffleProspectCompanies<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

/**
 * Picks the real target + a random decoy subset, then shuffles so order never hints.
 */
export function pickProspectDirectorySubset(
  rows: readonly ProspectDirectoryCompanyRow[],
  decoyCount = PROSPECT_DIRECTORY_DECOY_COUNT
): ProspectDirectoryCompanyRow[] {
  const target = rows.find((row) => row.isTarget);
  const decoys = shuffleProspectCompanies(rows.filter((row) => !row.isTarget)).slice(
    0,
    decoyCount
  );
  const combined = target ? [target, ...decoys] : decoys;
  return shuffleProspectCompanies(combined);
}

/**
 * Builds a per-company research system prompt — identical instructions for every company.
 * Never implies which account (if any) is the simulation target.
 */
function buildResearchPrompt(
  company: ProspectDirectoryCompany,
  guardrailDrill: string
): string {
  const contactLines =
    company.contacts.length > 0
      ? `\n- Known contacts:\n${company.contacts
          .map(
            (contact) =>
              `  - ${contact.name}, ${contact.title}${
                contact.department ? ` (${contact.department})` : ""
              }`
          )
          .join("\n")}`
      : "";

  return `You are an AI research assistant helping a sales student research a single company for a Tempo sales simulation. Treat this company with the same neutral care you would give any other account in the directory; do not imply it is preferred, correct, or "the" target.

ABOUT TEMPO: Scheduling software for appointment-based businesses (dental, vet, PT, optometry, med spa, chiropractic, and similar). Key value: cut no-shows, free the front desk, capture after-hours demand, drive repeat visits. Pricing: Starter $99/location/month, Pro $179/location/month. Proof points: 35% drop in no-shows in 90 days, 6 hours/week saved per location, 20% of bookings happen outside hours.

KNOWN FACTS ABOUT THIS COMPANY (ground your answers here):
- Name: ${company.name}
- Industry: ${company.industry}
- Scale: ${company.sizeLabel}
- Recent signal: ${company.signalHint}${contactLines}

Answer the student's questions using only these known facts plus general, non-specific industry context that would apply equally to any similar business. Do not invent additional named contacts, exact revenue, competitor contracts, or other specifics that are not listed above. When asked about contacts, share every known contact's name, title, and department factually, but never tell the student which contact is the "right", "best", or "primary" person to pursue. Evaluating who actually owns this decision is the student's job.

${guardrailDrill}

IMPORTANT: Write in plain English only. Do not use LaTeX, TeX, math delimiters ($ or $$), or markdown code blocks. Use normal punctuation for numbers and percentages (e.g. 15-20%, not $15\\text{-}20\\%$).`;
}

const GENERIC_GUARDRAIL_DRILL =
  "GUARDRAIL DRILL: In roughly one out of every four answers, include ONE plausible but unsupported detail that is NOT in the known facts (for example a guessed tool, a guessed headcount nuance, or a guessed initiative). Present that detail confidently without labeling it as uncertain — the student must practice spotting unverified claims. In all other answers, stay strictly within known facts and clearly say when you do not know.";

/**
 * Legacy/public prompt builder. Dedicated research chat requests now use the
 * server-only builder below so hidden claims never enter browser state.
 */
export function buildScopedResearchPrompt(company: ProspectDirectoryCompany): string {
  return buildResearchPrompt(company, GENERIC_GUARDRAIL_DRILL);
}

/**
 * Builds the scoped prompt with a server-only scripted claim.
 * The claim is withheld until the third student exchange, required exactly on
 * that exchange, and omitted afterward to prevent accidental repetition.
 */
export function buildServerScopedResearchPrompt(
  company: ProspectDirectoryCompanyRow,
  priorStudentMessageCount: number
): string {
  const publicCompany = toPublicProspectCompany(company);
  const hiddenClaim = company.hiddenClaim?.trim();
  if (!hiddenClaim) {
    return buildResearchPrompt(publicCompany, GENERIC_GUARDRAIL_DRILL);
  }

  let guardrailDrill: string;
  if (priorStudentMessageCount < 2) {
    guardrailDrill =
      "GUARDRAIL DRILL: This company has one scripted unsupported-detail exercise. Do not introduce it yet. Wait until the conversation has had at least two prior student messages. For this answer, stay strictly within known facts and clearly say when you do not know.";
  } else if (priorStudentMessageCount === 2) {
    guardrailDrill = `GUARDRAIL DRILL: This company has one scripted unsupported-detail exercise. In this answer, naturally work in this specific claim exactly once: "${hiddenClaim}". Explicitly frame it as plausible-sounding but unverified, never as a confirmed fact. Do not add any other unsupported detail.`;
  } else {
    guardrailDrill =
      "GUARDRAIL DRILL: This company's one scripted unsupported-detail exercise has already occurred. Do not repeat it or introduce another unsupported detail. Stay strictly within known facts and clearly say when you do not know.";
  }

  return buildResearchPrompt(publicCompany, guardrailDrill);
}

/**
 * True when the student has sent at least one research message for any company.
 */
export function hasProspectingResearchActivity(
  companyChats: Record<string, ChatMessage[]>
): boolean {
  return Object.values(companyChats).some((messages) =>
    messages.some((msg) => msg.role === "user")
  );
}
