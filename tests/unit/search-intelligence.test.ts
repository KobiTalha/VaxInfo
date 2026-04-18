import {
    buildRecommendationAnswer,
    detectIntent,
    detectRecommendationKind,
    formatSeverityTag,
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
        id: 10,
        name: "MMR",
        type: "Live attenuated",
        doses: "2 doses",
        dosageSchedule: "Dose 1 then dose 2",
        ageGroup: "Infants and children",
        sideEffects: ["Fever"],
        vaccineType: "live",
        coveragePercent: 80,
        region: "Global",
        introductionYear: 1971
      }
    ]
  },
  {
    id: 2,
    name: "Poliomyelitis",
    aliases: ["polio"],
    category: "viral",
    severity: "high_risk",
    mandatory: true,
    vaccines: [
      {
        id: 20,
        name: "IPV",
        type: "Inactivated",
        doses: "3 doses",
        dosageSchedule: "2, 4, 6 months",
        ageGroup: "Infants and children",
        sideEffects: ["Soreness"],
        vaccineType: "inactive",
        coveragePercent: 78,
        region: "Western Pacific",
        introductionYear: 1955
      }
    ]
  }
];

describe("search intelligence", () => {
  it("detects recommendation intent", () => {
    expect(detectIntent("travel vaccine recommendations for africa")).toBe("recommendation");
    expect(detectRecommendationKind("travel vaccine recommendations for africa")).toBe("travel");
  });

  it("supports multi-disease query matching", () => {
    const matched = matchDiseasesFromQuery("measles and polio vaccines", diseases);
    expect(matched.map((item) => item.name)).toEqual(["Measles", "Poliomyelitis"]);
  });

  it("formats severity tag for mandatory diseases", () => {
    expect(formatSeverityTag("mandatory", true)).toBe("mandatory");
    expect(formatSeverityTag("high_risk", false)).toBe("high-risk");
  });

  it("builds child recommendation answer", () => {
    const answer = buildRecommendationAnswer("child_schedule", diseases, null);
    expect(answer).toContain("Child vaccination schedule recommendations");
    expect(answer).toContain("Measles");
  });
});
