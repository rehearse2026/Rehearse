/**
 * generate-prospect-directory.ts
 * Reusable prospect-directory seeder — simulation content lives in config files.
 * Wipes and regenerates crm_prospect_directory + contacts for one simulation_id.
 * Runnable via: npx tsx scripts/generate-prospect-directory.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  failsVisibleIcpAxis,
  scoreIcpFit,
  type IcpFitCompanyInput,
} from "./config/tempo-icp";
import { randomPerson } from "./shared/person-name-pool";

// ── Contact + company shapes ─────────────────────────────────────────────────

export interface ContactEntry {
  contactName: string;
  contactTitle: string;
  department: string;
  gender: "male" | "female";
}

export interface DesignedTrapContact extends ContactEntry {
  strongerAxis: string;
  weakerAxis: string;
}

export interface DesignedContactSet {
  correct: ContactEntry;
  traps: DesignedTrapContact[];
}

export type CompanyClass = "strong_fit" | "near_miss" | "trap" | "pass";
export type TriggerQuality = "strong" | "weak" | "none";

export type NearMissSubtype =
  | "too_small"
  | "no_strain"
  | "adjacent_vertical"
  | "too_big"
  | "out_of_territory";

export type TrapSubtype =
  | "already_solved"
  | "franchise_power"
  | "contracting"
  | "phantom_fit";

export interface DesignedCompany {
  companyName: string;
  vertical: string;
  locations: number;
  metro: string;
  inTerritory: boolean;
  sizeNote: string;
  onlineBooking: boolean;
  blurb: string;
  publicSignals: string[];
  researchFacts: string[];
  class: CompanyClass;
  subtype: string | null;
  fitRank: number | null;
  triggerQuality: TriggerQuality;
  keyedTrigger: string | null;
  bestContact: string | null;
  why: string | null;
  contactSet?: DesignedContactSet;
  /** Trap-only: the single discoverable disqualifier merged into research_facts at finalize. */
  trapDisqualifierFact?: string;
}

export interface ComparableAxis<TSubject> {
  name: string;
  keywords: string[];
  getValue: (subject: TSubject, config: TempoDirectorySeedConfig) => number | null;
}

export type FactPoolEntry = {
  text: string;
  theme: string;
};

export type TriggerSignatureTheme = {
  id: string;
  matchers: string[];
};

export interface TempoDirectorySeedConfig {
  simulationId: string;
  authoredCompanies: DesignedCompany[];
  generationPlan: {
    strong_fit: number;
    near_miss: number;
    trap: number;
    pass: number;
  };
  corePainDepartment: string;
  /** Target-only: no other company may match more than one theme across public_signals. */
  targetTriggerSignatureThemes: TriggerSignatureTheme[];
  /** Per-vertical research fact pool with theme tags for within-company dedup. */
  researchFactsByVertical: Record<string, FactPoolEntry[]>;
  /** Per-vertical public signal pool for procedural generation. */
  publicSignalsByVertical: Record<string, string[]>;
  /** Trap-subtype public signals that avoid the target trigger signature pair. */
  publicSignalsByTrapSubtype: Record<TrapSubtype, string[]>;
  /** Keywords that identify disqualifier-themed facts for trap validation. */
  disqualifierKeywordsByTrapSubtype: Record<TrapSubtype, string[]>;
  verticalPool: string[];
  metroPoolInTerritory: string[];
  metroPoolOutOfTerritory: string[];
  passVerticalPool: string[];
  namePrefixPool: string[];
  nameDescriptorPool: string[];
  passPrefixPool: string[];
  suffixByVertical: Record<string, string[]>;
  passSuffixByVertical: Record<string, string[]>;
  contactTitlePool: string[];
  contactDepartmentPool: string[];
  contactTitleSeniorityRank: string[];
  contactComparableAxes: ComparableAxis<ContactEntry>[];
}

type EntryType = "target" | "crafted_decoy" | "filler";

type DirectoryRowInsert = {
  simulation_id: string;
  company_name: string;
  industry: string;
  size_locations: string;
  signal_hint: string;
  hidden_claim: string | null;
  entry_type: EntryType;
  is_active: boolean;
  in_data_room: boolean;
  vertical: string;
  locations: number;
  metro: string;
  in_territory: boolean;
  size_note: string;
  online_booking: boolean;
  blurb: string;
  public_signals: string[];
  research_facts: string[];
  class: CompanyClass;
  subtype: string | null;
  fit_rank: number | null;
  trigger_quality: TriggerQuality;
  keyed_trigger: string | null;
  best_contact: string | null;
  why: string | null;
};

type ContactRowInsert = {
  company_id: string;
  contact_name: string;
  contact_title: string;
  department: string;
  gender: "male" | "female";
  is_correct_contact: boolean;
  stronger_axis: string | null;
  weaker_axis: string | null;
};

type CompetitorWithAxes = {
  strongerAxis: string;
  weakerAxis: string;
};

export type GenerationReport = {
  warnings: string[];
  countsByClass: Record<CompanyClass, number>;
  countsBySubtype: Record<string, number>;
  mostReusedFact: { sentence: string; count: number } | null;
  mostReusedSignal: { sentence: string; count: number } | null;
  factReuseViolations: Array<{ sentence: string; count: number }>;
  signalReuseViolations: Array<{ sentence: string; count: number }>;
};

const GENERATION_RETRY_MAX = 80;
const MAX_FIRST_WORD_OCCURRENCES = 2;
const SUMMIT_FIRST_WORD = "summit";
const MAX_SENTENCE_REUSE_ACROSS_COMPANIES = 2;
const TRAP_MIN_RESEARCH_FACTS = 4;

const TRAP_DISQUALIFIER_BY_SUBTYPE: Record<TrapSubtype, string> = {
  already_solved:
    "Signed a multi-year agreement with a scheduling vendor last year.",
  franchise_power:
    "Corporate franchise office mandates approved vendor lists for all locations.",
  contracting: "Finance memo cites a freeze on discretionary software spend.",
  phantom_fit:
    "Expansion headline was a rebranding of an existing location, not a new site opening.",
};

const NEAR_MISS_SUBTYPES: NearMissSubtype[] = [
  "too_small",
  "no_strain",
  "adjacent_vertical",
  "too_big",
  "out_of_territory",
];

const TRAP_SUBTYPES: TrapSubtype[] = [
  "already_solved",
  "franchise_power",
  "contracting",
  "phantom_fit",
];

/**
 * Picks a random element from a non-empty array.
 */
function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

/**
 * Normalizes company names for uniqueness checks (R6).
 */
export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const ALLOWED_SUMMIT_NAMES = new Set(
  ["Summit Dental Group", "Summit Outdoor Gear"].map(normalizeCompanyName)
);

/**
 * Returns the first whitespace-delimited token of a company name.
 */
export function companyFirstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Fisher–Yates shuffle (returns a new array).
 */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

/**
 * Builds a per-class spread of fact counts in [2, 5] with at least one of each
 * when the class has four or more companies. Traps use [4, 5] only.
 */
export function spreadFactCounts(classSize: number, companyClass?: CompanyClass): number[] {
  if (classSize <= 0) {
    return [];
  }
  const cycle =
    companyClass === "trap" ? ([4, 5] as const) : ([2, 3, 4, 5] as const);
  const counts: number[] = [];
  while (counts.length < classSize) {
    counts.push(cycle[counts.length % cycle.length] as number);
  }
  const spreadWidth = companyClass === "trap" ? 2 : 4;
  if (classSize >= spreadWidth) {
    for (let index = 0; index < spreadWidth; index += 1) {
      if (!counts.includes(cycle[index] as number)) {
        counts[index] = cycle[index] as number;
      }
    }
  }
  return shuffle(counts);
}

/**
 * Tracks sentence reuse across all companies (facts and public signals).
 */
class SentenceUsageRegistry {
  private readonly counts = new Map<string, number>();

  canUse(sentence: string): boolean {
    const key = sentence.trim().toLowerCase();
    return (this.counts.get(key) ?? 0) < MAX_SENTENCE_REUSE_ACROSS_COMPANIES;
  }

  register(sentence: string): void {
    const key = sentence.trim().toLowerCase();
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  violations(): Array<{ sentence: string; count: number }> {
    return Array.from(this.counts.entries())
      .filter(([, count]) => count > MAX_SENTENCE_REUSE_ACROSS_COMPANIES)
      .map(([sentence, count]) => ({ sentence, count }));
  }

  mostReused(): { sentence: string; count: number } | null {
    let best: { sentence: string; count: number } | null = null;
    for (const [sentence, count] of Array.from(this.counts.entries())) {
      if (!best || count > best.count) {
        best = { sentence, count };
      }
    }
    return best;
  }

  reset(): void {
    this.counts.clear();
  }
}

const globalFactUsage = new SentenceUsageRegistry();
const globalSignalUsage = new SentenceUsageRegistry();

function textMatchesAny(text: string, matchers: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return matchers.some((matcher) => lower.includes(matcher.toLowerCase()));
}

export function countMatchedTriggerThemes(
  signals: readonly string[],
  themes: readonly TriggerSignatureTheme[]
): number {
  const matched = new Set<string>();
  for (const theme of themes) {
    if (signals.some((signal) => textMatchesAny(signal, theme.matchers))) {
      matched.add(theme.id);
    }
  }
  return matched.size;
}

function factMatchesDisqualifierTheme(
  fact: string,
  subtype: TrapSubtype,
  config: TempoDirectorySeedConfig
): boolean {
  const keywords = config.disqualifierKeywordsByTrapSubtype[subtype] ?? [];
  return textMatchesAny(fact, keywords);
}

function allocateResearchFacts(
  company: DesignedCompany,
  count: number,
  existing: readonly string[],
  config: TempoDirectorySeedConfig,
  excludeDisqualifierThemes = false,
  disqualifierSubtype?: TrapSubtype
): string[] {
  const pool = config.researchFactsByVertical[company.vertical];
  if (!pool || pool.length === 0) {
    throw new Error(
      `No research fact pool for vertical "${company.vertical}". Expand researchFactsByVertical.`
    );
  }

  const usedTexts = new Set(existing.map((fact) => fact.trim().toLowerCase()));
  const usedThemes = new Set<string>();
  for (const fact of existing) {
    const entry = pool.find((item) => item.text.trim().toLowerCase() === fact.trim().toLowerCase());
    if (entry) {
      usedThemes.add(entry.theme);
    }
  }

  const picked: string[] = [];
  for (const entry of shuffle(pool)) {
    if (picked.length >= count) {
      break;
    }
    const key = entry.text.trim().toLowerCase();
    if (usedTexts.has(key) || usedThemes.has(entry.theme)) {
      continue;
    }
    if (!globalFactUsage.canUse(entry.text)) {
      continue;
    }
    if (
      excludeDisqualifierThemes &&
      disqualifierSubtype &&
      factMatchesDisqualifierTheme(entry.text, disqualifierSubtype, config)
    ) {
      continue;
    }
    picked.push(entry.text);
    usedTexts.add(key);
    usedThemes.add(entry.theme);
    globalFactUsage.register(entry.text);
  }

  if (picked.length < count) {
    throw new Error(
      `Research fact pool for "${company.vertical}" too small for ${count} themed facts (got ${picked.length}).`
    );
  }

  return picked;
}

function allocatePublicSignals(
  pool: readonly string[],
  count: number,
  existing: readonly string[] = []
): string[] {
  const used = new Set(existing.map((signal) => signal.trim().toLowerCase()));
  const picked: string[] = [...existing];
  for (const signal of shuffle(pool)) {
    if (picked.length >= count) {
      break;
    }
    const key = signal.trim().toLowerCase();
    if (used.has(key) || !globalSignalUsage.canUse(signal)) {
      continue;
    }
    picked.push(signal);
    used.add(key);
    globalSignalUsage.register(signal);
  }

  if (picked.length < count) {
    throw new Error(
      `Public signal pool too small for ${count} signals (got ${picked.length}).`
    );
  }

  return picked.slice(0, count);
}

function registerAuthoredSentences(companies: readonly DesignedCompany[]): void {
  for (const company of companies) {
    for (const fact of company.researchFacts) {
      globalFactUsage.register(fact);
    }
    for (const signal of company.publicSignals) {
      globalSignalUsage.register(signal);
    }
  }
}

/**
 * Tracks company-name uniqueness, first-word limits, and substring collisions.
 */
export class CompanyNameRegistry {
  private readonly usedNames = new Set<string>();
  private readonly firstWordCounts = new Map<string, number>();

  /**
   * Registers an authored name that must be accepted as-is.
   */
  registerAuthored(name: string): void {
    if (!this.tryRegister(name)) {
      throw new Error(`Authored company name "${name}" violates name registry rules.`);
    }
  }

  /**
   * Attempts to register a candidate company name. Returns false when rejected.
   */
  tryRegister(name: string): boolean {
    if (name.includes("(") || name.includes(")")) {
      return false;
    }
    const normalized = normalizeCompanyName(name);
    if (this.usedNames.has(normalized)) {
      return false;
    }
    for (const existing of Array.from(this.usedNames)) {
      if (normalized.includes(existing) || existing.includes(normalized)) {
        return false;
      }
    }
    const firstWord = companyFirstWord(name).toLowerCase();
    if (firstWord === SUMMIT_FIRST_WORD && !ALLOWED_SUMMIT_NAMES.has(normalized)) {
      return false;
    }
    const count = this.firstWordCounts.get(firstWord) ?? 0;
    if (count >= MAX_FIRST_WORD_OCCURRENCES) {
      return false;
    }
    this.usedNames.add(normalized);
    this.firstWordCounts.set(firstWord, count + 1);
    return true;
  }

  get size(): number {
    return this.usedNames.size;
  }
}

/**
 * Expands every company's research_facts to an assigned count; traps require 4–5.
 */
export function finalizeResearchFacts(
  companies: DesignedCompany[],
  config: TempoDirectorySeedConfig
): void {
  const byClass = new Map<CompanyClass, DesignedCompany[]>();
  for (const company of companies) {
    const group = byClass.get(company.class) ?? [];
    group.push(company);
    byClass.set(company.class, group);
  }

  for (const [companyClass, group] of Array.from(byClass.entries())) {
    const targets = spreadFactCounts(group.length, companyClass);
    for (let index = 0; index < group.length; index += 1) {
      const company = group[index] as DesignedCompany;
      const targetCount = targets[index] as number;
      const disqualifier =
        company.trapDisqualifierFact ??
        (company.class === "trap" && company.subtype
          ? TRAP_DISQUALIFIER_BY_SUBTYPE[company.subtype as TrapSubtype]
          : null);
      const trapSubtype =
        company.class === "trap" && company.subtype
          ? (company.subtype as TrapSubtype)
          : undefined;

      let seedFacts = company.researchFacts.filter(
        (fact) => !disqualifier || fact.trim() !== disqualifier.trim()
      );
      if (trapSubtype) {
        seedFacts = seedFacts.filter(
          (fact) => !factMatchesDisqualifierTheme(fact, trapSubtype, config)
        );
      }

      const neededNeutral = targetCount - seedFacts.length - (disqualifier ? 1 : 0);
      const padding =
        neededNeutral > 0
          ? allocateResearchFacts(
              company,
              neededNeutral,
              [...seedFacts, ...(disqualifier ? [disqualifier] : [])],
              config,
              company.class === "trap",
              trapSubtype
            )
          : [];

      const neutralFacts = [...seedFacts, ...padding].slice(
        0,
        targetCount - (disqualifier ? 1 : 0)
      );

      if (disqualifier) {
        const insertAt =
          company.class === "trap"
            ? 1 + Math.floor(Math.random() * Math.max(1, neutralFacts.length))
            : Math.floor(Math.random() * (neutralFacts.length + 1));
        company.researchFacts = [
          ...neutralFacts.slice(0, insertAt),
          disqualifier,
          ...neutralFacts.slice(insertAt),
        ];
      } else {
        company.researchFacts = neutralFacts.slice(0, targetCount);
      }

      const minFacts = company.class === "trap" ? TRAP_MIN_RESEARCH_FACTS : 2;
      if (company.researchFacts.length < minFacts || company.researchFacts.length > 5) {
        throw new Error(
          `research_facts for "${company.companyName}" must be between ${minFacts} and 5 after finalize (got ${company.researchFacts.length}).`
        );
      }
    }
  }
}

/**
 * Maps a vertical slug to a display industry label for legacy columns.
 */
export function verticalToIndustry(vertical: string): string {
  const labels: Record<string, string> = {
    dental: "Dental",
    veterinary: "Veterinary",
    "physical therapy": "Physical Therapy",
    optometry: "Optometry",
    "med spa": "Med Spa",
    chiropractic: "Chiropractic",
    retail: "Retail",
    hospitality: "Hospitality",
    "auto repair": "Auto Repair",
    "legal services": "Legal Services",
    "fitness studio": "Fitness Studio",
    "property management": "Property Management",
    "urgent care": "Urgent Care",
  };
  return labels[vertical.toLowerCase()] ?? vertical;
}

/**
 * Converts a designed company into ICP scoring input.
 */
function toIcpInput(company: DesignedCompany): IcpFitCompanyInput {
  return {
    vertical: company.vertical,
    locations: company.locations,
    metro: company.metro,
    onlineBooking: company.onlineBooking,
  };
}

/**
 * Generic win-count validator for designed trap contacts.
 */
export function validateCompetitorsAgainstCanonical<TSubject>(options: {
  candidates: Array<TSubject & CompetitorWithAxes>;
  canonical: TSubject;
  axes: Array<Pick<ComparableAxis<TSubject>, "name" | "keywords" | "getValue">>;
  config: TempoDirectorySeedConfig;
  labelFor: (candidate: TSubject & CompetitorWithAxes) => string;
}): void {
  const { candidates, canonical, axes, config, labelFor } = options;

  for (const candidate of candidates) {
    const label = labelFor(candidate);
    if (!candidate.strongerAxis?.trim()) {
      throw new Error(`Competitor "${label}" is missing required field strongerAxis.`);
    }
    if (!candidate.weakerAxis?.trim()) {
      throw new Error(`Competitor "${label}" is missing required field weakerAxis.`);
    }

    const winningAxes = axes.filter((axis) => {
      const candidateValue = axis.getValue(candidate, config);
      const canonicalValue = axis.getValue(canonical, config);
      return (
        candidateValue !== null &&
        canonicalValue !== null &&
        candidateValue > canonicalValue
      );
    });

    if (winningAxes.length > 1) {
      throw new Error(
        `Competitor "${label}" out-performs the canonical subject on multiple axes: ${winningAxes
          .map((axis) => axis.name)
          .join(", ")}.`
      );
    }

    if (winningAxes.length === 0) {
      console.warn(
        `[generate-prospect-directory] Competitor "${label}" does not measurably out-perform the canonical subject on any configured axis; double-check that this is intentional.`
      );
      continue;
    }

    const winningAxis = winningAxes[0];
    const declaredStrength = candidate.strongerAxis.toLowerCase();
    const referencesWinningAxis = winningAxis.keywords.some((keyword) =>
      declaredStrength.includes(keyword.toLowerCase())
    );
    if (!referencesWinningAxis) {
      console.warn(
        `[generate-prospect-directory] Competitor "${label}" wins on axis "${winningAxis.name}", but strongerAxis may not reference that measured strength.`
      );
    }
  }
}

/**
 * Validates designed contact sets for companies that declare them.
 */
export function validateDesignedContactSets(
  companies: DesignedCompany[],
  config: TempoDirectorySeedConfig
): void {
  for (const company of companies) {
    if (company.class !== "pass" && !company.contactSet) {
      throw new Error(
        `Company "${company.companyName}" (${company.class}) is missing contactSet.`
      );
    }
    if (!company.contactSet) {
      continue;
    }
    const label = company.companyName.trim() || "(unnamed company)";
    if (!company.contactSet.correct) {
      throw new Error(`Designed company "${label}" is missing contactSet.correct.`);
    }
    if (!Array.isArray(company.contactSet.traps) || company.contactSet.traps.length !== 2) {
      throw new Error(
        `Designed company "${label}" must declare exactly 2 trap contacts in contactSet.traps.`
      );
    }

    validateCompetitorsAgainstCanonical({
      candidates: company.contactSet.traps,
      canonical: company.contactSet.correct,
      axes: config.contactComparableAxes,
      config,
      labelFor: (trap) =>
        `${label} / ${trap.contactName.trim() || "(unnamed trap contact)"}`,
    });
  }
}

/**
 * Builds a unique company name from prefix/suffix pools without parenthetical fallbacks.
 */
function buildUniqueCompanyName(
  registry: CompanyNameRegistry,
  prefix: string,
  suffix: string,
  config: TempoDirectorySeedConfig
): string | null {
  const candidates: string[] = [`${prefix} ${suffix}`];
  for (const descriptor of shuffle(config.nameDescriptorPool)) {
    candidates.push(`${prefix} ${descriptor} ${suffix}`);
  }

  for (const candidate of candidates) {
    if (registry.tryRegister(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Builds a unique pass-class company name from pass-specific pools.
 */
function buildUniquePassCompanyName(
  registry: CompanyNameRegistry,
  config: TempoDirectorySeedConfig,
  vertical: string
): string | null {
  const suffixes = config.passSuffixByVertical[vertical] ?? ["Group"];
  const prefixes = shuffle(config.passPrefixPool);

  for (const prefix of prefixes) {
    for (const suffix of shuffle(suffixes)) {
      const candidates = [`${prefix} ${suffix}`];
      for (const descriptor of shuffle(config.nameDescriptorPool)) {
        candidates.push(`${prefix} ${descriptor} ${suffix}`);
      }
      for (const candidate of candidates) {
        if (registry.tryRegister(candidate)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

const globalUsedContactNames = new Set<string>();

function normalizeContactName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Registers authored contact names so procedural generation avoids collisions.
 */
export function registerAuthoredContactNames(companies: DesignedCompany[]): void {
  for (const company of companies) {
    if (!company.contactSet) {
      continue;
    }
    for (const contact of [company.contactSet.correct, ...company.contactSet.traps]) {
      globalUsedContactNames.add(normalizeContactName(contact.contactName));
    }
  }
}

/**
 * Returns a person with a globally unique full name for this generation run.
 */
function randomUniquePerson(): ReturnType<typeof randomPerson> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const person = randomPerson();
    const fullName = normalizeContactName(`${person.firstName} ${person.lastName}`);
    if (!globalUsedContactNames.has(fullName)) {
      globalUsedContactNames.add(fullName);
      return person;
    }
  }
  throw new Error(
    "Person name pool too small: could not allocate a unique contact full name. Expand person-name-pool.ts."
  );
}

/**
 * Builds a procedural contact set with one correct contact and two traps.
 */
function buildProceduralContactSet(
  config: TempoDirectorySeedConfig,
  bestTitle = "Director of Operations"
): DesignedContactSet {
  const correctPerson = randomUniquePerson();
  const trapOnePerson = randomUniquePerson();
  const trapTwoPerson = randomUniquePerson();
  const correct: ContactEntry = {
    contactName: `${correctPerson.firstName} ${correctPerson.lastName}`,
    contactTitle: bestTitle,
    department: config.corePainDepartment,
    gender: correctPerson.gender,
  };

  return {
    correct,
    traps: [
      {
        contactName: `${trapOnePerson.firstName} ${trapOnePerson.lastName}`,
        contactTitle: "VP of Finance",
        department: "Finance",
        gender: trapOnePerson.gender,
        strongerAxis: "seniority — VP outranks the operations lead on paper",
        weakerAxis: "wrong department — Finance does not own scheduling tooling",
      },
      {
        contactName: `${trapTwoPerson.firstName} ${trapTwoPerson.lastName}`,
        contactTitle: "Front Desk Lead",
        department: config.corePainDepartment,
        gender: trapTwoPerson.gender,
        strongerAxis:
          "department relevance — front-line role closest to scheduling friction",
        weakerAxis: "insufficient seniority to approve a vendor purchase",
      },
    ],
  };
}

/**
 * Creates one procedural near-miss company for a requested subtype.
 */
function buildNearMissCompany(
  subtype: NearMissSubtype,
  config: TempoDirectorySeedConfig,
  registry: CompanyNameRegistry
): DesignedCompany {
  for (let attempt = 0; attempt < GENERATION_RETRY_MAX; attempt += 1) {
    const vertical = subtype === "adjacent_vertical" ? "urgent care" : pickRandom(config.verticalPool);
    const suffixes =
      subtype === "adjacent_vertical"
        ? ["Urgent Care", "Walk-In Clinic"]
        : config.suffixByVertical[vertical] ?? ["Group"];
    const companyName = buildUniqueCompanyName(
      registry,
      pickRandom(config.namePrefixPool),
      pickRandom(suffixes),
      config
    );
    if (!companyName) {
      continue;
    }

    let locations = pickRandom([4, 5, 6, 7, 8]);
    let metro = pickRandom(config.metroPoolInTerritory);
    let onlineBooking = false;
    let triggerQuality: TriggerQuality = "weak";
    let keyedTrigger: string | null = "Operational review cycle";
    let publicSignals = allocatePublicSignals(
      config.publicSignalsByVertical[vertical] ?? [],
      3
    );
    let researchFacts: string[] = [];

    if (subtype === "too_small") {
      locations = pickRandom([1, 2]);
    } else if (subtype === "too_big") {
      locations = pickRandom([13, 14, 15, 18]);
    } else if (subtype === "out_of_territory") {
      metro = pickRandom(config.metroPoolOutOfTerritory);
    } else if (subtype === "no_strain") {
      triggerQuality = "none";
      keyedTrigger = null;
      publicSignals = allocatePublicSignals(
        (config.publicSignalsByVertical[vertical] ?? []).filter(
          (signal) =>
            countMatchedTriggerThemes([signal], config.targetTriggerSignatureThemes) === 0
        ),
        3
      );
      researchFacts = [];
    } else {
      researchFacts = [];
    }

    const inTerritory = config.metroPoolInTerritory.includes(metro);
    const contactSet = buildProceduralContactSet(config);
    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory,
      sizeNote: `${locations} location${locations === 1 ? "" : "s"}`,
      onlineBooking,
      blurb: `${verticalToIndustry(vertical)} operator in ${metro}.`,
      publicSignals,
      researchFacts,
      class: "near_miss",
      subtype,
      fitRank: null,
      triggerQuality,
      keyedTrigger,
      bestContact: contactSet.correct.contactName,
      why: `Near-miss (${subtype}) — defensible but weaker than the room's top fit.`,
      contactSet,
    };
    const score = scoreIcpFit(toIcpInput(company));
    const failsAxisOrTrigger =
      score.axesPassed < 4 || company.triggerQuality === "none" || company.triggerQuality === "weak";
    const triggerThemes = countMatchedTriggerThemes(
      company.publicSignals,
      config.targetTriggerSignatureThemes
    );
    if (!failsAxisOrTrigger || triggerThemes > 1) {
      continue;
    }

    return company;
  }

  throw new Error(
    `Could not build near_miss company for subtype "${subtype}". Expand name pools if name allocation failed.`
  );
}

/**
 * Creates one procedural trap company for a requested subtype.
 */
function buildTrapCompany(
  subtype: TrapSubtype,
  config: TempoDirectorySeedConfig,
  registry: CompanyNameRegistry
): DesignedCompany {
  for (let attempt = 0; attempt < GENERATION_RETRY_MAX; attempt += 1) {
    const vertical = pickRandom(config.verticalPool);
    const suffixes = config.suffixByVertical[vertical] ?? ["Group"];
    const companyName = buildUniqueCompanyName(
      registry,
      pickRandom(config.namePrefixPool),
      pickRandom(suffixes),
      config
    );
    if (!companyName) {
      continue;
    }

    const locations = pickRandom([4, 5, 6, 7, 8, 9, 10]);
    const metro = pickRandom(config.metroPoolInTerritory);
    let onlineBooking = false;
    let triggerQuality: TriggerQuality = pickRandom(["strong", "weak"] as const);
    let researchFacts: string[] = [];
    const signalPool = config.publicSignalsByTrapSubtype[subtype];
    let publicSignals = allocatePublicSignals(signalPool, 3);
    let keyedTrigger = "Operational growth signals";
    const trapDisqualifierFact = TRAP_DISQUALIFIER_BY_SUBTYPE[subtype];

    if (subtype === "already_solved") {
      onlineBooking = true;
      keyedTrigger = "Portal refresh marketing push";
    } else if (subtype === "contracting") {
      triggerQuality = "strong";
      keyedTrigger = "Administrative staff reduction";
    } else if (subtype === "phantom_fit") {
      keyedTrigger = "Announced location opening";
    } else if (subtype === "franchise_power") {
      keyedTrigger = "Regional expansion coverage";
    }

    const contactSet = buildProceduralContactSet(config);
    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory: true,
      sizeNote: `${locations} locations`,
      onlineBooking,
      blurb: `${verticalToIndustry(vertical)} group operating across ${metro}.`,
      publicSignals,
      researchFacts,
      class: "trap",
      subtype,
      fitRank: null,
      triggerQuality,
      keyedTrigger,
      bestContact: contactSet.correct.contactName,
      why: `Trap (${subtype}) — attractive on the card, disqualifier lives in research.`,
      contactSet,
      trapDisqualifierFact,
    };
    const score = scoreIcpFit(toIcpInput(company));
    const attractive =
      score.axesPassed >= 3 &&
      (company.triggerQuality === "strong" || company.triggerQuality === "weak");
    const triggerThemes = countMatchedTriggerThemes(
      company.publicSignals,
      config.targetTriggerSignatureThemes
    );
    if (!attractive || triggerThemes > 1) {
      continue;
    }

    return company;
  }

  throw new Error(
    `Could not build trap company for subtype "${subtype}". Expand name pools if name allocation failed.`
  );
}

/**
 * Creates one procedural strong_fit company that cannot outrank Summit (R2).
 */
function buildSecondaryStrongFit(
  config: TempoDirectorySeedConfig,
  registry: CompanyNameRegistry
): DesignedCompany {
  for (let attempt = 0; attempt < GENERATION_RETRY_MAX; attempt += 1) {
    const vertical = pickRandom(config.verticalPool);
    const suffixes = config.suffixByVertical[vertical] ?? ["Group"];
    const companyName = buildUniqueCompanyName(
      registry,
      pickRandom(config.namePrefixPool),
      pickRandom(suffixes),
      config
    );
    if (!companyName) {
      continue;
    }

    const locations = pickRandom([4, 5, 6, 7, 9, 10]);
    const metro = pickRandom(config.metroPoolInTerritory);
    const triggerQuality: TriggerQuality =
      Math.random() < 0.5 ? "weak" : pickRandom(["strong", "weak"] as const);
    const onlineBooking = Math.random() < 0.15;

    const contactSet = buildProceduralContactSet(config);
    const verticalSignals = config.publicSignalsByVertical[vertical] ?? [];
    const publicSignals = allocatePublicSignals(verticalSignals, 3);
    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory: true,
      sizeNote: `${locations} locations`,
      onlineBooking,
      blurb: `${verticalToIndustry(vertical)} operator with recent operational signals.`,
      publicSignals,
      researchFacts: [],
      class: "strong_fit",
      subtype: null,
      fitRank: null,
      triggerQuality,
      keyedTrigger: "Recent location opening",
      bestContact: contactSet.correct.contactName,
      why: "Strong fit on paper but weaker trigger or axis coverage than Summit.",
      contactSet,
    };
    const score = scoreIcpFit(toIcpInput(company));
    const summitPerfect =
      score.axesPassed === 4 && company.triggerQuality === "strong";
    const triggerThemes = countMatchedTriggerThemes(
      company.publicSignals,
      config.targetTriggerSignatureThemes
    );
    if (summitPerfect || triggerThemes > 1) {
      continue;
    }

    return company;
  }

  throw new Error(
    "Could not build secondary strong_fit company. Expand name pools if name allocation failed."
  );
}

/**
 * Creates one pass-class company that fails a visible ICP axis (R3).
 */
function buildPassCompany(
  config: TempoDirectorySeedConfig,
  registry: CompanyNameRegistry,
  forceName?: string
): DesignedCompany {
  for (let attempt = 0; attempt < GENERATION_RETRY_MAX; attempt += 1) {
    const vertical = pickRandom(config.passVerticalPool);
    const companyName =
      forceName ?? buildUniquePassCompanyName(registry, config, vertical);
    if (!companyName) {
      continue;
    }

    const locations = pickRandom([4, 5, 6, 7, 8]);
    const metro = pickRandom([
      ...config.metroPoolInTerritory,
      ...config.metroPoolOutOfTerritory,
    ]);
    const inTerritory = config.metroPoolInTerritory.includes(metro);
    const passSignals = config.publicSignalsByVertical[vertical] ?? [];

    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory,
      sizeNote: `${locations} locations`,
      onlineBooking: Math.random() < 0.4,
      blurb: `${verticalToIndustry(vertical)} business operating in ${metro}.`,
      publicSignals: allocatePublicSignals(passSignals, 2),
      researchFacts: [],
      class: "pass",
      subtype: null,
      fitRank: null,
      triggerQuality: "none",
      keyedTrigger: null,
      bestContact: null,
      why: "Fails at least one visible ICP axis.",
      contactSet: undefined,
    };

    if (!failsVisibleIcpAxis(toIcpInput(company))) {
      continue;
    }

    if (forceName) {
      if (!registry.tryRegister(forceName)) {
        throw new Error(`Forced pass company name "${forceName}" violates name registry rules.`);
      }
    }

    return company;
  }

  throw new Error(
    "Could not build pass company that fails a visible ICP axis. If retries were exhausted due to names, expand passPrefixPool, passSuffixByVertical, or nameDescriptorPool."
  );
}

/**
 * Subtracts authored counts from the generation plan per class.
 */
export function resolveProceduralCounts(config: TempoDirectorySeedConfig): {
  strong_fit: number;
  near_miss: number;
  trap: number;
  pass: number;
} {
  const authoredByClass = config.authoredCompanies.reduce(
    (acc, company) => {
      acc[company.class] += 1;
      return acc;
    },
    { strong_fit: 0, near_miss: 0, trap: 0, pass: 0 } as Record<CompanyClass, number>
  );

  return {
    strong_fit: Math.max(0, config.generationPlan.strong_fit - authoredByClass.strong_fit),
    near_miss: Math.max(0, config.generationPlan.near_miss - authoredByClass.near_miss),
    trap: Math.max(0, config.generationPlan.trap - authoredByClass.trap),
    pass: Math.max(0, config.generationPlan.pass - authoredByClass.pass),
  };
}

/**
 * Validates target trigger signature isolation and content diversity rules.
 */
export function validateContentQuality(
  companies: DesignedCompany[],
  config: TempoDirectorySeedConfig
): void {
  const target = companies.find((company) => company.fitRank === 1);
  if (!target) {
    throw new Error("Target company with fit_rank 1 not found.");
  }

  for (const company of companies) {
    if (company.fitRank === 1) {
      continue;
    }
    const matchedThemes = countMatchedTriggerThemes(
      company.publicSignals,
      config.targetTriggerSignatureThemes
    );
    if (matchedThemes > 1) {
      throw new Error(
        `Target trigger signature violated: "${company.companyName}" matches ${matchedThemes} signature themes in public_signals.`
      );
    }
  }

  const factViolations = globalFactUsage.violations();
  if (factViolations.length > 0) {
    throw new Error(
      `Fact reuse limit exceeded: ${factViolations
        .map((item) => `"${item.sentence}" (${item.count})`)
        .join("; ")}`
    );
  }

  const signalViolations = globalSignalUsage.violations();
  if (signalViolations.length > 0) {
    throw new Error(
      `Public signal reuse limit exceeded: ${signalViolations
        .map((item) => `"${item.sentence}" (${item.count})`)
        .join("; ")}`
    );
  }

  for (const company of companies) {
    const pool = config.researchFactsByVertical[company.vertical] ?? [];
    const themes = new Set<string>();
    for (const fact of company.researchFacts) {
      const entry = pool.find((item) => item.text.trim() === fact.trim());
      if (entry) {
        if (themes.has(entry.theme)) {
          throw new Error(
            `Duplicate fact theme "${entry.theme}" within "${company.companyName}".`
          );
        }
        themes.add(entry.theme);
      }
    }
  }

  for (const company of companies) {
    if (company.class !== "trap" || !company.subtype) {
      continue;
    }
    const subtype = company.subtype as TrapSubtype;
    const disqualifier =
      company.trapDisqualifierFact ?? TRAP_DISQUALIFIER_BY_SUBTYPE[subtype];
    const disqualifierMatches = company.researchFacts.filter(
      (fact) =>
        fact.trim() === disqualifier.trim() ||
        factMatchesDisqualifierTheme(fact, subtype, config)
    );
    if (disqualifierMatches.length !== 1) {
      throw new Error(
        `Trap "${company.companyName}" has ${disqualifierMatches.length} disqualifier-themed facts (expected 1).`
      );
    }
    if (company.researchFacts.length < TRAP_MIN_RESEARCH_FACTS) {
      throw new Error(
        `Trap "${company.companyName}" has ${company.researchFacts.length} research_facts (minimum ${TRAP_MIN_RESEARCH_FACTS}).`
      );
    }
    const disqualifierIndex = company.researchFacts.findIndex(
      (fact) => fact.trim() === disqualifier.trim()
    );
    if (disqualifierIndex === 0) {
      throw new Error(
        `Trap "${company.companyName}" has disqualifier as first research_fact.`
      );
    }
  }
}

/**
 * Builds the full 64-company roster from authored + procedural slots.
 */
export function buildCompanyRoster(config: TempoDirectorySeedConfig): DesignedCompany[] {
  globalFactUsage.reset();
  globalSignalUsage.reset();
  globalUsedContactNames.clear();
  const registry = new CompanyNameRegistry();
  for (const company of config.authoredCompanies) {
    registry.registerAuthored(company.companyName);
  }
  registerAuthoredSentences(config.authoredCompanies);
  const procedural = resolveProceduralCounts(config);
  const companies: DesignedCompany[] = [...config.authoredCompanies];

  for (let index = 0; index < procedural.strong_fit; index += 1) {
    companies.push(buildSecondaryStrongFit(config, registry));
  }

  const nearMissQueue: NearMissSubtype[] = [];
  while (nearMissQueue.length < procedural.near_miss) {
    for (const subtype of NEAR_MISS_SUBTYPES) {
      if (nearMissQueue.length >= procedural.near_miss) {
        break;
      }
      nearMissQueue.push(subtype);
    }
  }
  const outOfTerritoryCount = nearMissQueue.filter((subtype) => subtype === "out_of_territory")
    .length;
  if (outOfTerritoryCount < 4 && procedural.near_miss >= 4) {
    for (let swap = 0; swap < 4 - outOfTerritoryCount; swap += 1) {
      const replaceIndex = nearMissQueue.findIndex((subtype) => subtype === "no_strain");
      if (replaceIndex >= 0) {
        nearMissQueue[replaceIndex] = "out_of_territory";
      }
    }
  }
  for (const subtype of nearMissQueue) {
    companies.push(buildNearMissCompany(subtype, config, registry));
  }

  const trapQueue: TrapSubtype[] = [];
  while (trapQueue.length < procedural.trap) {
    for (const subtype of TRAP_SUBTYPES) {
      if (trapQueue.length >= procedural.trap) {
        break;
      }
      trapQueue.push(subtype);
    }
  }
  for (const subtype of trapQueue) {
    companies.push(buildTrapCompany(subtype, config, registry));
  }

  for (let index = 0; index < procedural.pass; index += 1) {
    if (index === 0) {
      companies.push(buildPassCompany(config, registry, "Summit Outdoor Gear"));
      continue;
    }
    companies.push(buildPassCompany(config, registry));
  }

  registerAuthoredContactNames(companies);
  finalizeResearchFacts(companies, config);
  validateContentQuality(companies, config);
  return companies;
}

/**
 * Validates answer-key rules R1–R6. Throws on hard failures.
 */
export function validateAnswerKey(
  companies: DesignedCompany[],
  warnings: string[]
): void {
  const summit = companies.find((company) => company.fitRank === 1);
  if (!summit || summit.class !== "strong_fit") {
    throw new Error("R1 violated: exactly one strong_fit must have fit_rank 1.");
  }
  const rankOneCount = companies.filter((company) => company.fitRank === 1).length;
  if (rankOneCount !== 1) {
    throw new Error("R1 violated: fit_rank 1 must appear exactly once.");
  }
  if (normalizeCompanyName(summit.companyName) !== normalizeCompanyName("Summit Dental Group")) {
    throw new Error("R1 violated: fit_rank 1 must belong to Summit Dental Group.");
  }

  const summitScore = scoreIcpFit(toIcpInput(summit));
  for (const company of companies) {
    if (company.class !== "strong_fit" || company.fitRank === 1) {
      continue;
    }
    const score = scoreIcpFit(toIcpInput(company));
    const matchesSummit =
      score.axesPassed === summitScore.axesPassed &&
      score.axesPassed === 4 &&
      company.triggerQuality === "strong";
    if (matchesSummit) {
      throw new Error(
        `R2 violated: secondary strong_fit "${company.companyName}" matches Summit on all axes with a strong trigger.`
      );
    }
  }

  for (const company of companies) {
    if (company.class !== "pass") {
      continue;
    }
    if (!failsVisibleIcpAxis(toIcpInput(company))) {
      throw new Error(
        `R3 violated: pass company "${company.companyName}" is in-vertical, in-range, and in-territory.`
      );
    }
  }

  for (const company of companies) {
    if (company.class !== "near_miss") {
      continue;
    }
    const score = scoreIcpFit(toIcpInput(company));
    const defensible =
      score.axesPassed < 4 ||
      company.triggerQuality === "none" ||
      company.triggerQuality === "weak";
    if (!defensible) {
      throw new Error(`R4 violated: near_miss "${company.companyName}" is too strong.`);
    }
  }

  for (const company of companies) {
    if (company.class !== "trap") {
      continue;
    }
    const score = scoreIcpFit(toIcpInput(company));
    const attractive =
      score.axesPassed >= 3 &&
      (company.triggerQuality === "strong" || company.triggerQuality === "weak");
    if (!attractive) {
      throw new Error(`R5 violated: trap "${company.companyName}" is not attractive enough.`);
    }
    if (company.researchFacts.length === 0) {
      throw new Error(`R5 violated: trap "${company.companyName}" has empty research_facts.`);
    }
    if (company.researchFacts.length < TRAP_MIN_RESEARCH_FACTS) {
      throw new Error(
        `R5 violated: trap "${company.companyName}" must have at least ${TRAP_MIN_RESEARCH_FACTS} research_facts.`
      );
    }
  }

  const normalized = companies.map((company) => normalizeCompanyName(company.companyName));
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new Error("R6 violated: duplicate company names after normalization.");
  }

  for (const company of companies) {
    if (company.companyName.includes("(") || company.companyName.includes(")")) {
      throw new Error(
        `R6 violated: company name "${company.companyName}" contains a parenthetical qualifier.`
      );
    }
  }

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      const a = normalized[left] as string;
      const b = normalized[right] as string;
      if (a.includes(b) || b.includes(a)) {
        throw new Error(
          `R6 violated: normalized company names form a substring pair (${companies[left]?.companyName} / ${companies[right]?.companyName}).`
        );
      }
    }
  }

  const firstWordCounts = new Map<string, number>();
  for (const company of companies) {
    const firstWord = companyFirstWord(company.companyName).toLowerCase();
    firstWordCounts.set(firstWord, (firstWordCounts.get(firstWord) ?? 0) + 1);
  }
  for (const [firstWord, count] of Array.from(firstWordCounts.entries())) {
    if (count > MAX_FIRST_WORD_OCCURRENCES) {
      throw new Error(
        `R6 violated: first word "${firstWord}" appears ${count} times (max ${MAX_FIRST_WORD_OCCURRENCES}).`
      );
    }
  }
  const summitCount = firstWordCounts.get(SUMMIT_FIRST_WORD) ?? 0;
  if (summitCount !== 2) {
    throw new Error(
      `R6 violated: first word "Summit" must appear exactly twice (got ${summitCount}).`
    );
  }

  const factCountsByClass = new Map<CompanyClass, number[]>();
  for (const company of companies) {
    const group = factCountsByClass.get(company.class) ?? [];
    group.push(company.researchFacts.length);
    factCountsByClass.set(company.class, group);
  }
  for (const [companyClass, lengths] of Array.from(factCountsByClass.entries())) {
    const minLength = companyClass === "trap" ? TRAP_MIN_RESEARCH_FACTS : 2;
    if (lengths.some((length) => length < minLength || length > 5)) {
      throw new Error(
        `research_facts count for class "${companyClass}" must stay within ${minLength}–5 (got ${lengths.join(", ")}).`
      );
    }
    if (new Set(lengths).size === 1) {
      throw new Error(
        `research_facts count for class "${companyClass}" has no spread (all ${lengths[0]}).`
      );
    }
  }

  if (companies.length !== 64) {
    throw new Error(`Expected 64 companies, received ${companies.length}.`);
  }

  if (
    companies.filter((company) => company.class === "strong_fit").length !== 9 ||
    companies.filter((company) => company.class === "near_miss").length !== 16 ||
    companies.filter((company) => company.class === "trap").length !== 7 ||
    companies.filter((company) => company.class === "pass").length !== 32
  ) {
    throw new Error("Class distribution does not match 9 / 16 / 7 / 32 plan.");
  }

  warnings.push(
    `Validated ${companies.length} companies; Summit fit_rank 1 with ${summitScore.axesPassed}/4 ICP axes and trigger "${summit.triggerQuality}".`
  );
}

/**
 * Maps a designed company to a database insert row.
 */
function toInsertRow(simulationId: string, company: DesignedCompany): DirectoryRowInsert {
  const entryType: EntryType =
    company.fitRank === 1 ? "target" : company.class === "trap" ? "crafted_decoy" : "filler";

  return {
    simulation_id: simulationId,
    company_name: company.companyName,
    industry: verticalToIndustry(company.vertical),
    size_locations: `${company.locations} location${company.locations === 1 ? "" : "s"}`,
    signal_hint: company.publicSignals[0] ?? "",
    hidden_claim: null,
    entry_type: entryType,
    is_active: true,
    in_data_room: true,
    vertical: company.vertical,
    locations: company.locations,
    metro: company.metro,
    in_territory: company.inTerritory,
    size_note: company.sizeNote,
    online_booking: company.onlineBooking,
    blurb: company.blurb,
    public_signals: company.publicSignals,
    research_facts: company.researchFacts,
    class: company.class,
    subtype: company.subtype,
    fit_rank: company.fitRank,
    trigger_quality: company.triggerQuality,
    keyed_trigger: company.keyedTrigger,
    best_contact: company.bestContact,
    why: company.why,
  };
}

function buildDesignedContactRows(
  companyId: string,
  contactSet: DesignedContactSet
): ContactRowInsert[] {
  return [
    {
      company_id: companyId,
      contact_name: contactSet.correct.contactName,
      contact_title: contactSet.correct.contactTitle,
      department: contactSet.correct.department,
      gender: contactSet.correct.gender,
      is_correct_contact: true,
      stronger_axis: null,
      weaker_axis: null,
    },
    ...contactSet.traps.map((trap) => ({
      company_id: companyId,
      contact_name: trap.contactName,
      contact_title: trap.contactTitle,
      department: trap.department,
      gender: trap.gender,
      is_correct_contact: false,
      stronger_axis: trap.strongerAxis,
      weaker_axis: trap.weakerAxis,
    })),
  ];
}

function buildFillerContactRows(companyId: string, config: TempoDirectorySeedConfig): ContactRowInsert[] {
  const contacts = [randomUniquePerson(), randomUniquePerson(), randomUniquePerson()];
  return contacts.map((person, index) => ({
    company_id: companyId,
    contact_name: `${person.firstName} ${person.lastName}`,
    contact_title: pickRandom(config.contactTitlePool),
    department: pickRandom(config.contactDepartmentPool),
    gender: person.gender,
    is_correct_contact: index === 0,
    stronger_axis: null,
    weaker_axis: null,
  }));
}

async function wipeSimulationDirectory(
  supabase: SupabaseClient,
  simulationId: string
): Promise<void> {
  const { data: companies, error } = await supabase
    .from("crm_prospect_directory")
    .select("id")
    .eq("simulation_id", simulationId);

  if (error) {
    throw new Error(`Could not load existing directory rows: ${error.message}`);
  }

  const companyIds = (companies ?? []).map((row) => String(row.id));
  if (companyIds.length === 0) {
    return;
  }

  const { error: deleteContactsError } = await supabase
    .from("crm_prospect_contacts")
    .delete()
    .in("company_id", companyIds);
  if (deleteContactsError) {
    throw new Error(`Could not delete existing contacts: ${deleteContactsError.message}`);
  }

  const { error: deleteCompaniesError } = await supabase
    .from("crm_prospect_directory")
    .delete()
    .eq("simulation_id", simulationId);
  if (deleteCompaniesError) {
    throw new Error(`Could not delete existing directory rows: ${deleteCompaniesError.message}`);
  }
}

/**
 * Wipes and regenerates the Tempo prospect directory for one simulation.
 */
export async function generateProspectDirectory(
  supabase: SupabaseClient,
  config: TempoDirectorySeedConfig
): Promise<{ insertedCompanies: number; insertedContacts: number; report: GenerationReport }> {
  const { error: schemaError } = await supabase
    .from("crm_prospect_directory")
    .select("vertical")
    .limit(1);
  if (schemaError?.message.includes("vertical")) {
    throw new Error(
      "Missing data-room v2 columns. Run supabase/data-room-v2-migration.sql in the Supabase SQL editor first."
    );
  }

  const warnings: string[] = [];
  const companies = buildCompanyRoster(config);
  validateDesignedContactSets(companies, config);
  validateAnswerKey(companies, warnings);

  await wipeSimulationDirectory(supabase, config.simulationId);

  const rows = companies.map((company) => toInsertRow(config.simulationId, company));
  const { data: inserted, error: insertError } = await supabase
    .from("crm_prospect_directory")
    .insert(rows)
    .select("id, company_name, class");

  if (insertError || !inserted) {
    throw new Error(`Insert failed: ${insertError?.message ?? "unknown"}`);
  }

  const designedByName = new Map(
    companies
      .filter((company) => company.contactSet)
      .map((company) => [company.companyName, company.contactSet as DesignedContactSet])
  );

  const contactRows: ContactRowInsert[] = [];
  for (const row of inserted) {
    const contactSet = designedByName.get(String(row.company_name));
    if (contactSet) {
      contactRows.push(...buildDesignedContactRows(String(row.id), contactSet));
      continue;
    }
    contactRows.push(...buildFillerContactRows(String(row.id), config));
  }

  const { error: contactInsertError } = await supabase
    .from("crm_prospect_contacts")
    .insert(contactRows);
  if (contactInsertError) {
    throw new Error(`Contact insert failed: ${contactInsertError.message}`);
  }

  const countsByClass = companies.reduce(
    (acc, company) => {
      acc[company.class] += 1;
      return acc;
    },
    { strong_fit: 0, near_miss: 0, trap: 0, pass: 0 } as Record<CompanyClass, number>
  );
  const countsBySubtype: Record<string, number> = {};
  for (const company of companies) {
    if (!company.subtype) {
      continue;
    }
    countsBySubtype[company.subtype] = (countsBySubtype[company.subtype] ?? 0) + 1;
  }

  return {
    insertedCompanies: inserted.length,
    insertedContacts: contactRows.length,
    report: {
      warnings,
      countsByClass,
      countsBySubtype,
      mostReusedFact: globalFactUsage.mostReused(),
      mostReusedSignal: globalSignalUsage.mostReused(),
      factReuseViolations: globalFactUsage.violations(),
      signalReuseViolations: globalSignalUsage.violations(),
    },
  };
}

function loadEnvLocalIfNeeded(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

async function runCli(): Promise<void> {
  loadEnvLocalIfNeeded();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { tempoDirectorySeed } = await import("./config/tempo-directory-seed");
  const supabase = createClient(url, key);
  const result = await generateProspectDirectory(supabase, tempoDirectorySeed);
  console.log(
    `Done. Inserted ${result.insertedCompanies} company row(s), synced ${result.insertedContacts} contact row(s).`
  );
  console.log("Class counts:", result.report.countsByClass);
  console.log("Subtype counts:", result.report.countsBySubtype);
  for (const warning of result.report.warnings) {
    console.warn(warning);
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
