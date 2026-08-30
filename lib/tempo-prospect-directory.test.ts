/**
 * tempo-prospect-directory.test.ts
 * Asserts public prospect-directory payloads never expose hidden answer-key fields.
 * Run via: npx tsx lib/tempo-prospect-directory.test.ts
 */

import assert from "node:assert/strict";
import {
  assertNoHiddenFieldsInPublicPayload,
  HIDDEN_PROSPECT_DIRECTORY_FIELD_NAMES,
  PUBLIC_PROSPECT_COMPANY_KEYS,
  toPublicProspectCompany,
  type ProspectDirectoryCompanyRow,
} from "./tempo-prospect-directory";

const sampleRow: ProspectDirectoryCompanyRow = {
  id: "test-id",
  name: "Summit Dental Group",
  industry: "Dental",
  sizeLabel: "8 locations",
  signalHint: "Opened 8th location three months ago",
  hiddenClaim: "should-not-leak",
  isTarget: true,
  vertical: "dental",
  locations: 8,
  metro: "Front Range, CO",
  inTerritory: true,
  sizeNote: "8 locations across the Front Range",
  onlineBooking: false,
  blurb: "Multi-location dental group.",
  publicSignals: ["Opened 8th location three months ago"],
  researchFacts: ["Hidden research fact"],
  class: "strong_fit",
  subtype: null,
  fitRank: 1,
  triggerQuality: "strong",
  keyedTrigger: "8th location + front-desk hiring",
  bestContact: "Dana Reyes",
  why: "Answer key",
  entryType: "target",
  contacts: [{ name: "Dana Reyes", title: "Director of Operations", department: "Operations" }],
};

const publicPayload = toPublicProspectCompany(sampleRow);
assertNoHiddenFieldsInPublicPayload(publicPayload);

for (const hidden of HIDDEN_PROSPECT_DIRECTORY_FIELD_NAMES) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(publicPayload, hidden),
    false,
    `hidden field leaked: ${hidden}`
  );
}

for (const key of Object.keys(publicPayload)) {
  assert.ok(
    (PUBLIC_PROSPECT_COMPANY_KEYS as readonly string[]).includes(key),
    `unexpected public key: ${key}`
  );
}

console.log("tempo-prospect-directory public payload guard: ok");
