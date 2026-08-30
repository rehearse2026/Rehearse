/**
 * tempo-directory-seed.ts
 * Tempo simulation prospect-directory seed config (Rehearse Essentials).
 * Hand-authored companies drop in via authoredCompanies without code changes.
 */

import { TEMPO_SIMULATION_ID } from "../../lib/constants";
import type { TempoDirectorySeedConfig } from "../generate-prospect-directory";

export const tempoDirectorySeed: TempoDirectorySeedConfig = {
  simulationId: TEMPO_SIMULATION_ID,
  corePainDepartment: "Operations",
  generationPlan: {
    strong_fit: 9,
    near_miss: 16,
    trap: 7,
    pass: 32,
  },
  authoredCompanies: [
    {
      companyName: "Summit Dental Group",
      vertical: "dental",
      locations: 8,
      metro: "Front Range, CO",
      inTerritory: true,
      sizeNote: "8 locations across the Front Range",
      onlineBooking: false,
      blurb:
        "Multi-location dental group scaling appointment volume across Colorado front-range markets.",
      publicSignals: [
        "Opened 8th location three months ago",
        "Job listing: Front Desk Coordinator",
        "Review theme: long phone hold times",
      ],
      researchFacts: [
        "Patient reviews repeatedly mention phones are always busy and callbacks take hours.",
        "Local business journal covered the 8th-location opening and noted scheduling strain at the front desk.",
      ],
      class: "strong_fit",
      subtype: null,
      fitRank: 1,
      triggerQuality: "strong",
      keyedTrigger: "8th location + front-desk hiring",
      bestContact: "Dana Reyes",
      why: "ICP-true on every axis with the strongest live trigger in the room.",
      contactSet: {
        correct: {
          contactName: "Dana Reyes",
          contactTitle: "Director of Operations",
          department: "Operations",
          gender: "female",
        },
        traps: [
          {
            contactName: "Marcus Webb",
            contactTitle: "VP of Finance",
            department: "Finance",
            gender: "male",
            strongerAxis: "seniority — VP outranks Director",
            weakerAxis:
              "wrong department — Finance doesn't own scheduling tooling decisions",
          },
          {
            contactName: "Priya Shah",
            contactTitle: "Front Desk Lead",
            department: "Operations",
            gender: "female",
            strongerAxis:
              "closest to the daily pain, same department — operations relevance",
            weakerAxis: "no purchasing authority to approve a vendor tool",
          },
        ],
      },
    },
    {
      companyName: "BrightSmile Dental Partners",
      vertical: "dental",
      locations: 6,
      metro: "Denver, CO",
      inTerritory: true,
      sizeNote: "6 locations, stable footprint since last expansion",
      onlineBooking: false,
      blurb: "Established dental group with steady multi-site operations in Denver.",
      publicSignals: [
        "Expanded to current size about two years ago",
        "No recent location openings reported",
        "Routine hiring for hygienists only",
      ],
      researchFacts: [
        "Staff have mentioned wanting better software, but no budget has been allocated.",
        "Operations notes from a trade meetup describe scheduling as 'under control' after the last expansion.",
      ],
      class: "near_miss",
      subtype: "no_strain",
      fitRank: null,
      triggerQuality: "weak",
      keyedTrigger: "Stale expansion from two years ago",
      bestContact: "Jordan Alvarez",
      why: "Passes firmographics but lacks a live operational trigger.",
      contactSet: {
        correct: {
          contactName: "Jordan Alvarez",
          contactTitle: "Office Manager",
          department: "Operations",
          gender: "female",
        },
        traps: [
          {
            contactName: "Wei Zhang",
            contactTitle: "VP of Finance",
            department: "Finance",
            gender: "male",
            strongerAxis: "seniority — VP title looks more impressive than Office Manager",
            weakerAxis:
              "wrong department — Finance is not the buyer for scheduling operations tooling",
          },
          {
            contactName: "Fatima Hassan",
            contactTitle: "Front Desk Lead",
            department: "Operations",
            gender: "female",
            strongerAxis:
              "department relevance — same operations team closest to scheduling pain",
            weakerAxis: "far lower seniority — cannot authorize a new vendor",
          },
        ],
      },
    },
    {
      companyName: "Northview Family Dentistry",
      vertical: "dental",
      locations: 3,
      metro: "Boulder, CO",
      inTerritory: true,
      sizeNote: "3 locations in Boulder County",
      onlineBooking: true,
      blurb: "Family dentistry practice with a mature patient base and digital front desk tools.",
      publicSignals: [
        "Markets online self-scheduling on the website",
        "Steady Google review volume with no scheduling complaints",
        "Recently refreshed patient portal branding",
      ],
      researchFacts: [
        "Operations team standardized on SlotEasy eighteen months ago with a multi-year agreement.",
        "One location has slightly higher no-show rates, but leadership has not prioritized a change.",
      ],
      class: "trap",
      subtype: "already_solved",
      fitRank: null,
      triggerQuality: "weak",
      keyedTrigger: "Portal refresh marketing push",
      bestContact: "Rachel Chen",
      why: "Looks like a clean dental fit on size and territory; disqualifier is an incumbent tool in research.",
      contactSet: {
        correct: {
          contactName: "Rachel Chen",
          contactTitle: "Practice Manager",
          department: "Operations",
          gender: "female",
        },
        traps: [
          {
            contactName: "Diego Morales",
            contactTitle: "VP of Finance",
            department: "Finance",
            gender: "male",
            strongerAxis: "seniority — VP outranks Practice Manager on paper",
            weakerAxis:
              "wrong department — Finance does not own day-to-day scheduling decisions",
          },
          {
            contactName: "Amara Okonkwo",
            contactTitle: "Front Desk Lead",
            department: "Operations",
            gender: "female",
            strongerAxis:
              "operations department relevance — lives the appointment-booking friction daily",
            weakerAxis: "no budget authority despite being closest to the pain",
          },
        ],
      },
    },
    {
      companyName: "Golden State Dental Alliance",
      vertical: "dental",
      locations: 12,
      metro: "Colorado Springs, CO",
      inTerritory: true,
      sizeNote: "12 locations after recent consolidation",
      onlineBooking: false,
      blurb: "Large regional dental alliance with centralized back-office controls.",
      publicSignals: [
        "Recently reduced administrative staff as part of a cost-cutting initiative",
        "Hiring freeze on non-clinical roles announced in a local newsletter",
        "Leadership emphasizing margin protection in a staff memo excerpt",
      ],
      researchFacts: [
        "Leadership is reportedly cautious about new software spend given the recent cuts.",
        "Internal memo leaked to a trade blog cites a freeze on discretionary vendor projects through next fiscal year.",
      ],
      class: "trap",
      subtype: "contracting",
      fitRank: null,
      triggerQuality: "strong",
      keyedTrigger: "Administrative staff reduction headline",
      bestContact: "Miguel Torres",
      why: "Passes ICP axes and looks urgent, but hidden research shows contracting spend posture.",
      contactSet: {
        correct: {
          contactName: "Miguel Torres",
          contactTitle: "Practice Manager",
          department: "Operations",
          gender: "male",
        },
        traps: [
          {
            contactName: "Elena Kowalski",
            contactTitle: "VP of Finance",
            department: "Finance",
            gender: "female",
            strongerAxis: "seniority — VP of Finance outranks Practice Manager",
            weakerAxis:
              "wrong department — cost-cutting finance lead is the wrong owner for scheduling tooling",
          },
          {
            contactName: "Caleb Nguyen",
            contactTitle: "Front Desk Lead",
            department: "Operations",
            gender: "male",
            strongerAxis:
              "department relevance — operations front-line role matching the core pain area",
            weakerAxis:
              "insufficient seniority — cannot green-light a multi-location vendor purchase",
          },
        ],
      },
    },
  ],
  verticalPool: [
    "dental",
    "veterinary",
    "physical therapy",
    "optometry",
    "med spa",
    "chiropractic",
  ],
  metroPoolInTerritory: [
    "Denver, CO",
    "Front Range, CO",
    "Boulder, CO",
    "Fort Collins, CO",
    "Colorado Springs, CO",
    "Salt Lake City, UT",
    "Boise, ID",
    "Albuquerque, NM",
    "Cheyenne, WY",
    "Missoula, MT",
  ],
  metroPoolOutOfTerritory: [
    "Phoenix, AZ",
    "Seattle, WA",
    "Dallas, TX",
    "Chicago, IL",
    "Atlanta, GA",
    "Portland, OR",
    "Nashville, TN",
    "Minneapolis, MN",
  ],
  passVerticalPool: [
    "retail",
    "hospitality",
    "auto repair",
    "legal services",
    "fitness studio",
    "property management",
  ],
  namePrefixPool: [
    "Northview",
    "Brightside",
    "Lakeside",
    "Cedar Grove",
    "Riverside",
    "Union Square",
    "Maple",
    "Harbor",
    "Crestview",
    "Fairview",
    "Hillcrest",
    "Parkway",
    "Meadowbrook",
    "Stonebridge",
    "Oakhurst",
    "Ashford",
    "Birchwood",
    "Clearwater",
    "Dunmore",
    "Elmhurst",
    "Foxglove",
    "Glenwood",
    "Highpoint",
    "Ironwood",
    "Juniper",
    "Kingsley",
    "Laurelton",
    "Millbrook",
    "Norwood",
    "Pinehurst",
    "Quarry Hill",
    "Redstone",
    "Silverlake",
    "Thornbury",
    "Vista Ridge",
    "Westbrook",
    "Willowmere",
    "Ashgrove",
    "Brookfield",
    "Copperfield",
  ],
  suffixByVertical: {
    dental: ["Dental Group", "Family Dentistry", "Dental Care"],
    veterinary: ["Veterinary Partners", "Animal Hospital"],
    "physical therapy": ["Physical Therapy", "Rehab Partners"],
    optometry: ["Eye Care", "Vision Group"],
    "med spa": ["Med Spa", "Aesthetics"],
    chiropractic: ["Chiropractic Center", "Wellness Group"],
  },
  passSuffixPool: ["Outfitters", "Supply Co.", "Services", "Group", "Partners"],
  contactTitlePool: [
    "Front Desk Lead",
    "Office Manager",
    "Practice Manager",
    "Operations Coordinator",
    "Director of Operations",
  ],
  contactDepartmentPool: [
    "Operations",
    "Finance",
    "Front Desk",
    "Administration",
    "Clinical",
  ],
  contactTitleSeniorityRank: [
    "Front Desk Lead",
    "Office Manager",
    "Practice Manager",
    "Operations Coordinator",
    "Director of Operations",
    "VP of Finance",
    "Regional Director",
    "Owner",
    "Founder",
  ],
  contactComparableAxes: [
    {
      name: "seniority",
      keywords: ["senior", "seniority", "vp", "director", "title", "authority", "outrank"],
      getValue: (contact, config) =>
        config.contactTitleSeniorityRank.indexOf(contact.contactTitle),
    },
    {
      name: "department_relevance",
      keywords: ["department", "operations", "relevant", "relevance", "pain"],
      getValue: (contact, config) => {
        if (contact.department !== config.corePainDepartment) {
          return 0;
        }
        if (contact.contactTitle === "Front Desk Lead") {
          return 2;
        }
        return 1;
      },
    },
  ],
};
