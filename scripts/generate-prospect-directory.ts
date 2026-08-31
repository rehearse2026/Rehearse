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
  verticalPool: string[];
  metroPoolInTerritory: string[];
  metroPoolOutOfTerritory: string[];
  passVerticalPool: string[];
  namePrefixPool: string[];
  nameDescriptorPool: string[];
  passPrefixPool: string[];
  suffixByVertical: Record<string, string[]>;
  passSuffixPool: string[];
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
};

const GENERATION_RETRY_MAX = 80;
const MAX_FIRST_WORD_OCCURRENCES = 2;
const SUMMIT_FIRST_WORD = "summit";

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
 * when the class has four or more companies.
 */
export function spreadFactCounts(classSize: number): number[] {
  if (classSize <= 0) {
    return [];
  }
  const counts: number[] = [];
  const cycle = [2, 3, 4, 5];
  while (counts.length < classSize) {
    counts.push(cycle[counts.length % cycle.length] as number);
  }
  if (classSize >= 4) {
    for (let index = 0; index < 4; index += 1) {
      if (!counts.includes(cycle[index] as number)) {
        counts[index] = cycle[index] as number;
      }
    }
  }
  return shuffle(counts);
}

const NEUTRAL_RESEARCH_FACTS: Record<string, string[]> = {
  dental: [
    "Careers page lists hygienist openings at two locations.",
    "Google reviews praise friendly staff with occasional wait-time mentions.",
    "Local newsletter profiled the practice's community outreach program.",
    "Website highlights same-day emergency appointment availability.",
    "Patient forum threads discuss parking at the downtown location.",
  ],
  veterinary: [
    "Job board shows a part-time receptionist role at the north clinic.",
    "Yelp reviews mention compassionate care and weekend hours.",
    "Press release covered a pet adoption event hosted at one location.",
    "Social posts show updated signage after a minor lobby renovation.",
    "Trade blog noted the group's partnership with a regional animal shelter.",
  ],
  "physical therapy": [
    "Careers site advertises a new patient coordinator role.",
    "Reviews cite short intake paperwork and helpful front-desk staff.",
    "Clinic blog published tips for post-surgery rehab at home.",
    "Local paper mentioned expanded evening appointment blocks.",
    "Website lists insurance partners accepted at all sites.",
  ],
  optometry: [
    "Indeed listing seeks an optical sales associate.",
    "Google reviews highlight frame selection and quick eye exams.",
    "Facebook post promoted a back-to-school vision screening drive.",
    "Website advertises walk-in adjustments for eyeglass fittings.",
    "Chamber of commerce spotlighted the group's downtown storefront.",
  ],
  "med spa": [
    "Instagram campaign featured seasonal skincare packages.",
    "Reviews praise consultative staff and spa-like waiting areas.",
    "Hiring page lists a front-desk coordinator for the flagship studio.",
    "Local lifestyle magazine included the brand in a wellness roundup.",
    "Website FAQ notes online intake forms for first-time clients.",
  ],
  chiropractic: [
    "Careers page lists a chiropractic assistant opening.",
    "Reviews mention convenient parking and flexible morning hours.",
    "Blog post explained the group's approach to sports injury rehab.",
    "Community calendar listed a free posture workshop at one clinic.",
    "Website promotes new-patient specials without mentioning scheduling tools.",
  ],
  retail: [
    "Store locator shows six locations across the Mountain West.",
    "Indeed posts highlight seasonal floor staff hiring.",
    "Local business journal covered a holiday inventory expansion.",
    "Google reviews mention helpful associates and easy returns.",
    "Facebook event promoted a warehouse sale at the flagship store.",
  ],
  hospitality: [
    "Travel blog review praised renovated guest rooms and lobby Wi-Fi.",
    "Indeed listing seeks a night front-desk supervisor.",
    "TripAdvisor thread discusses breakfast buffet hours.",
    "Press mention covered a summer patio reopening.",
    "Website advertises group booking discounts for corporate retreats.",
  ],
  "auto repair": [
    "Google reviews cite transparent estimates and shuttle service.",
    "Careers page lists a service advisor trainee role.",
    "Local radio spot promoted a fall maintenance special.",
    "Website shows Saturday hours at two neighborhood shops.",
    "Chamber directory notes ASE-certified technicians on staff.",
  ],
  "legal services": [
    "Firm blog published a guide to small-business contract basics.",
    "LinkedIn post announced an associate attorney hire.",
    "Website lists practice areas without operational software mentions.",
    "Google reviews mention responsive paralegal support.",
    "Bar association newsletter featured the firm's pro-bono clinic.",
  ],
  "fitness studio": [
    "Instagram promoted a six-week beginner strength program.",
    "Indeed listing seeks part-time front-desk staff for early shifts.",
    "Google reviews highlight clean facilities and class variety.",
    "Local magazine listed the studio in a best-of fitness roundup.",
    "Website shows class schedules and intro membership offers.",
  ],
  "property management": [
    "Careers page lists a leasing coordinator for a portfolio of units.",
    "Google reviews mention responsive maintenance ticketing.",
    "Press release covered acquisition of a twelve-unit apartment block.",
    "Website FAQ describes tenant portal features for rent payments.",
    "Local real-estate blog profiled the firm's resident events program.",
  ],
  "urgent care": [
    "Website lists wait-time estimates by location on weekends.",
    "Indeed post seeks medical receptionists for evening shifts.",
    "Google reviews mention short visits for minor injuries.",
    "Health-system partnership press release noted shared branding.",
    "Patient forum discussed parking at the newest walk-in clinic.",
  ],
  _default: [
    "Careers page shows routine front-office hiring.",
    "Google reviews mention friendly staff and predictable hours.",
    "Local business journal ran a short profile on community involvement.",
    "Website highlights customer service policies and location hours.",
    "Social media posts focus on seasonal promotions rather than operations.",
  ],
};

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
 * Picks neutral research facts that are not duplicates of existing text.
 */
function pickNeutralResearchFacts(
  company: DesignedCompany,
  count: number,
  existing: readonly string[]
): string[] {
  const pool = [
    ...(NEUTRAL_RESEARCH_FACTS[company.vertical] ?? []),
    ...NEUTRAL_RESEARCH_FACTS._default,
  ];
  const used = new Set(existing.map((fact) => fact.trim().toLowerCase()));
  const picked: string[] = [];
  const shuffled = shuffle(pool);
  for (const fact of shuffled) {
    const key = fact.trim().toLowerCase();
    if (used.has(key)) {
      continue;
    }
    picked.push(fact);
    used.add(key);
    if (picked.length >= count) {
      break;
    }
  }
  let attempt = 0;
  while (picked.length < count && attempt < count * 4) {
    attempt += 1;
    const metro = company.metro.split(",")[0] ?? company.metro;
    const variant = `Public coverage notes steady ${verticalToIndustry(company.vertical).toLowerCase()} operations in ${metro}. (${picked.length + attempt})`;
    const key = variant.trim().toLowerCase();
    if (!used.has(key)) {
      picked.push(variant);
      used.add(key);
    }
  }
  return picked;
}

/**
 * Expands every company's research_facts to an assigned count in [2, 5].
 */
export function finalizeResearchFacts(companies: DesignedCompany[]): void {
  const byClass = new Map<CompanyClass, DesignedCompany[]>();
  for (const company of companies) {
    const group = byClass.get(company.class) ?? [];
    group.push(company);
    byClass.set(company.class, group);
  }

  for (const [, group] of Array.from(byClass.entries())) {
    const targets = spreadFactCounts(group.length);
    for (let index = 0; index < group.length; index += 1) {
      const company = group[index] as DesignedCompany;
      const targetCount = targets[index] as number;
      const disqualifier =
        company.trapDisqualifierFact ??
        (company.class === "trap" && company.subtype
          ? TRAP_DISQUALIFIER_BY_SUBTYPE[company.subtype as TrapSubtype]
          : null);

      const seedFacts = company.researchFacts.filter(
        (fact) => !disqualifier || fact.trim() !== disqualifier.trim()
      );
      const neededNeutral = targetCount - seedFacts.length - (disqualifier ? 1 : 0);
      const padding =
        neededNeutral > 0
          ? pickNeutralResearchFacts(company, neededNeutral, [
              ...seedFacts,
              ...(disqualifier ? [disqualifier] : []),
            ])
          : [];

      const neutralFacts = [...seedFacts, ...padding].slice(
        0,
        targetCount - (disqualifier ? 1 : 0)
      );

      if (disqualifier) {
        const insertAt = Math.floor(Math.random() * (neutralFacts.length + 1));
        company.researchFacts = [
          ...neutralFacts.slice(0, insertAt),
          disqualifier,
          ...neutralFacts.slice(insertAt),
        ];
      } else {
        company.researchFacts = neutralFacts.slice(0, targetCount);
      }

      if (company.researchFacts.length < 2 || company.researchFacts.length > 5) {
        throw new Error(
          `research_facts for "${company.companyName}" must be between 2 and 5 after finalize (got ${company.researchFacts.length}).`
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
  config: TempoDirectorySeedConfig
): string | null {
  const prefixes = shuffle(config.passPrefixPool);
  const suffixes = shuffle(config.passSuffixPool);

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
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
    let researchFacts: string[] = [];
    let publicSignals = ["Stable appointment volume with routine hiring only"];

    if (subtype === "too_small") {
      locations = pickRandom([1, 2]);
    } else if (subtype === "too_big") {
      locations = pickRandom([13, 14, 15, 18]);
    } else if (subtype === "out_of_territory") {
      metro = pickRandom(config.metroPoolOutOfTerritory);
    } else if (subtype === "no_strain") {
      triggerQuality = "none";
      keyedTrigger = null;
      publicSignals = ["No recent expansion or front-desk hiring reported"];
      researchFacts = ["Operations described current scheduling as steady in a trade profile."];
    } else {
      researchFacts = [
        "Leadership has not prioritized scheduling changes this quarter.",
      ];
    }

    if (subtype === "too_small") {
      locations = pickRandom([1, 2]);
    } else if (subtype === "too_big") {
      locations = pickRandom([13, 14, 15, 18]);
    } else if (subtype === "out_of_territory") {
      metro = pickRandom(config.metroPoolOutOfTerritory);
    } else if (subtype === "no_strain") {
      triggerQuality = "none";
      keyedTrigger = null;
      publicSignals = ["No recent expansion or front-desk hiring reported"];
      researchFacts = ["Operations described current scheduling as steady in a trade profile."];
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
    if (!failsAxisOrTrigger) {
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
    let publicSignals = [
      "Recent front-desk hiring push",
      "Review mentions long hold times on phones",
    ];
    let keyedTrigger = "Front-desk hiring wave";
    const trapDisqualifierFact = TRAP_DISQUALIFIER_BY_SUBTYPE[subtype];

    if (subtype === "already_solved") {
      onlineBooking = true;
      publicSignals = [
        "Website advertises online booking",
        "Recent marketing push for the patient portal",
      ];
    } else if (subtype === "contracting") {
      publicSignals = [
        "Announced administrative staff reductions",
        "Leadership memo emphasizes margin protection",
      ];
      triggerQuality = "strong";
      keyedTrigger = "Administrative staff reduction";
    } else if (subtype === "phantom_fit") {
      publicSignals = [
        "Press release about a 'new location' opening",
        "Social post celebrating growth",
      ];
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
    if (!attractive) {
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
    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory: true,
      sizeNote: `${locations} locations`,
      onlineBooking,
      blurb: `${verticalToIndustry(vertical)} operator with recent operational signals.`,
      publicSignals: [
        "Opened a new location within the last year",
        "Hiring front-desk coordinators",
      ],
      researchFacts: [
        "Trade coverage notes scheduling pressure, but less acute than market leaders.",
      ],
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
    if (summitPerfect) {
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
      forceName ??
      buildUniquePassCompanyName(registry, config);
    if (!companyName) {
      continue;
    }

    const locations = pickRandom([4, 5, 6, 7, 8]);
    const metro = pickRandom([
      ...config.metroPoolInTerritory,
      ...config.metroPoolOutOfTerritory,
    ]);
    const inTerritory = config.metroPoolInTerritory.includes(metro);

    const company: DesignedCompany = {
      companyName,
      vertical,
      locations,
      metro,
      inTerritory,
      sizeNote: `${locations} locations`,
      onlineBooking: Math.random() < 0.4,
      blurb: `${verticalToIndustry(vertical)} business operating in ${metro}.`,
      publicSignals: ["Routine operations with no notable public scheduling news"],
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
    "Could not build pass company that fails a visible ICP axis. If retries were exhausted due to names, expand passPrefixPool, passSuffixPool, or nameDescriptorPool."
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
 * Builds the full 64-company roster from authored + procedural slots.
 */
export function buildCompanyRoster(config: TempoDirectorySeedConfig): DesignedCompany[] {
  globalUsedContactNames.clear();
  const registry = new CompanyNameRegistry();
  for (const company of config.authoredCompanies) {
    registry.registerAuthored(company.companyName);
  }
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
  finalizeResearchFacts(companies);
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
    if (company.researchFacts.length < 2) {
      throw new Error(
        `R5 violated: trap "${company.companyName}" must have at least 2 research_facts.`
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
    if (lengths.some((length) => length < 2 || length > 5)) {
      throw new Error(
        `research_facts count for class "${companyClass}" must stay within 2–5 (got ${lengths.join(", ")}).`
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
    report: { warnings, countsByClass, countsBySubtype },
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
