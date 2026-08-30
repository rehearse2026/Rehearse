/**
 * tempo-icp.ts
 * Canonical Tempo ICP definition for prospect-directory generation.
 * Defines fit axes only — no answer-key or company data.
 */

export type IcpFitCompanyInput = {
  vertical: string;
  locations: number;
  metro: string;
  onlineBooking: boolean;
};

export type IcpFitScore = {
  verticalInScope: boolean;
  sizeInRange: boolean;
  inTerritory: boolean;
  lacksOnlineBooking: boolean;
  axesPassed: number;
};

/** Mountain West metros where Tempo reps are assigned to hunt. */
export const TEMPO_ICP = {
  verticals: [
    "dental",
    "veterinary",
    "physical therapy",
    "optometry",
    "med spa",
    "chiropractic",
  ],
  minLocations: 3,
  maxLocations: 12,
  territoryMetros: [
    "Front Range, CO",
    "Denver, CO",
    "Colorado Springs, CO",
    "Boulder, CO",
    "Fort Collins, CO",
    "Greeley, CO",
    "Pueblo, CO",
    "Salt Lake City, UT",
    "Provo, UT",
    "Ogden, UT",
    "Boise, ID",
    "Albuquerque, NM",
    "Santa Fe, NM",
    "Cheyenne, WY",
    "Casper, WY",
    "Missoula, MT",
    "Billings, MT",
    "Grand Junction, CO",
  ],
  requiresNoOnlineBooking: true,
} as const;

/**
 * Normalizes a vertical label for comparison against the ICP list.
 */
export function normalizeVertical(vertical: string): string {
  return vertical.trim().toLowerCase();
}

/**
 * Returns whether a metro string is inside the Tempo territory list.
 */
export function isMetroInTerritory(metro: string): boolean {
  const normalized = metro.trim().toLowerCase();
  return TEMPO_ICP.territoryMetros.some(
    (candidate) => candidate.trim().toLowerCase() === normalized
  );
}

/**
 * Scores how many ICP axes a company passes. Used by the directory generator.
 */
export function scoreIcpFit(company: IcpFitCompanyInput): IcpFitScore {
  const normalizedVertical = normalizeVertical(company.vertical);
  const verticalInScope = (TEMPO_ICP.verticals as readonly string[]).includes(normalizedVertical);
  const sizeInRange =
    company.locations >= TEMPO_ICP.minLocations &&
    company.locations <= TEMPO_ICP.maxLocations;
  const inTerritory = isMetroInTerritory(company.metro);
  const lacksOnlineBooking = TEMPO_ICP.requiresNoOnlineBooking
    ? !company.onlineBooking
    : true;

  const axesPassed = [
    verticalInScope,
    sizeInRange,
    inTerritory,
    lacksOnlineBooking,
  ].filter(Boolean).length;

  return {
    verticalInScope,
    sizeInRange,
    inTerritory,
    lacksOnlineBooking,
    axesPassed,
  };
}

/**
 * Visible-axis failure used to validate pass-class companies (R3).
 */
export function failsVisibleIcpAxis(company: IcpFitCompanyInput): boolean {
  const score = scoreIcpFit(company);
  return !score.verticalInScope || !score.sizeInRange || !score.inTerritory;
}
