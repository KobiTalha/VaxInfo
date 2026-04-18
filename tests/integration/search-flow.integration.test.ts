import {
    buildRecommendationAnswer,
    detectIntent,
    detectRecommendationKind,
    extractRegionHint,
    matchDiseasesFromQuery,
    type SearchDiseaseRecord
} from "@/lib/server/search-intelligence";
import { describe, expect, it } from "vitest";

const diseases: SearchDiseaseRecord[] = [
  {
    id: 1,
    name: "Measles",
    aliases: [],
    category: "viral",
    severity: "mandatory",
    mandatory: true,
    vaccines: [
      {
        id: 11,
        name: "MMR",
        type: "Live attenuated",
        doses: "2 doses",
        dosageSchedule: "Dose 1 then dose 2",
        ageGroup: "Infants and children",
        sideEffects: ["Fever"],
        vaccineType: "live",
        coveragePercent: 83,
        region: "Africa",
        introductionYear: 1971
      }
    ]
  },
  {
    id: 2,
    name: "Rabies",
    aliases: [],
    category: "viral",
    severity: "high_risk",
    mandatory: true,
    vaccines: [
      {
        id: 21,
        name: "Rabies Inactivated",
        type: "Inactivated",
        doses: "3 doses",
        dosageSchedule: "0, 7, 21 days",
        ageGroup: "Travelers",
        sideEffects: ["Soreness"],
        vaccineType: "inactive",
        coveragePercent: 30,
        region: "South-East Asia",
        introductionYear: 1967
      }
    ]
  }
];

describe("search flow integration", () => {
  it("handles travel recommendation flow", () => {
    const query = "travel vaccines for africa and measles";

    const intent = detectIntent(query);
    const recommendationKind = detectRecommendationKind(query);
    const region = extractRegionHint(query);
    const matched = matchDiseasesFromQuery(query, diseases);
    const answer = buildRecommendationAnswer(recommendationKind, matched, region);

    expect(intent).toBe("recommendation");
    expect(region).toBe("africa");
    expect(matched.length).toBeGreaterThan(0);
    expect(answer).toContain("Travel vaccine recommendations");
  });
});
