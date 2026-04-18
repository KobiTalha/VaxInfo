export type QueryIntent = "search" | "explanation" | "recommendation" | "analytics";

export type RecommendationKind = "child_schedule" | "travel" | "general";

export type SearchVaccineRecord = {
  id: number;
  name: string;
  type: string;
  doses: string;
  dosageSchedule: string;
  ageGroup: string;
  sideEffects: string[];
  vaccineType: string;
  coveragePercent: number | null;
  region: string | null;
  introductionYear: number | null;
};

export type SearchDiseaseRecord = {
  id: number;
  name: string;
  aliases: string[];
  category: string;
  severity: "low" | "moderate" | "high_risk" | "mandatory";
  mandatory: boolean;
  vaccines: SearchVaccineRecord[];
};

const WHO_REGIONS = [
  "africa",
  "americas",
  "south-east asia",
  "europe",
  "eastern mediterranean",
  "western pacific",
  "global"
] as const;

const EXPLANATION_HINTS = [
  "why",
  "explain",
  "importance",
  "important",
  "benefit",
  "what is",
  "how does"
];

const RECOMMENDATION_HINTS = [
  "recommend",
  "recommendation",
  "schedule",
  "should i take",
  "which vaccine",
  "child",
  "children",
  "travel",
  "traveler"
];

const ANALYTICS_HINTS = [
  "coverage",
  "trend",
  "top",
  "most searched",
  "analytics",
  "region",
  "dashboard"
];

export function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectIntent(query: string): QueryIntent {
  const normalized = normalizeText(query);

  if (EXPLANATION_HINTS.some((hint) => normalized.includes(hint))) {
    return "explanation";
  }

  if (RECOMMENDATION_HINTS.some((hint) => normalized.includes(hint))) {
    return "recommendation";
  }

  if (ANALYTICS_HINTS.some((hint) => normalized.includes(hint))) {
    return "analytics";
  }

  return "search";
}

export function detectRecommendationKind(query: string): RecommendationKind {
  const normalized = normalizeText(query);

  if (normalized.includes("child") || normalized.includes("infant") || normalized.includes("pediatric")) {
    return "child_schedule";
  }

  if (normalized.includes("travel") || normalized.includes("traveler") || normalized.includes("trip")) {
    return "travel";
  }

  return "general";
}

export function extractRegionHint(query: string) {
  const normalized = normalizeText(query);
  return WHO_REGIONS.find((region) => normalized.includes(region)) ?? null;
}

export function extractDiseaseTokens(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) {
    return [];
  }

  const splitOnConnectors = normalized
    .replace(/\b(and|or|vs|with|for|about|vaccines?|vaccine|recommendations?)\b/g, "|")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  const expanded = splitOnConnectors.flatMap((part) =>
    part
      .split(/[\/,]/)
      .map((segment) => segment.trim())
      .filter(Boolean)
  );

  return [...new Set(expanded)];
}

function textContainsWholeTerm(haystack: string, needle: string) {
  return (` ${haystack} `).includes(` ${needle} `);
}

export function matchDiseasesFromQuery(query: string, diseases: SearchDiseaseRecord[]) {
  const normalizedQuery = normalizeText(query);
  const diseaseTokens = extractDiseaseTokens(query);
  const candidates = [normalizedQuery, ...diseaseTokens].filter(Boolean);

  const matches: SearchDiseaseRecord[] = [];

  for (const disease of diseases) {
    const values = [disease.name, ...disease.aliases].map((value) => normalizeText(value));
    const hasMatch = values.some((value) => {
      if (!value) {
        return false;
      }

      return candidates.some((candidate) => {
        if (!candidate) {
          return false;
        }

        if (candidate === value) {
          return true;
        }

        if (candidate.length >= 3 && textContainsWholeTerm(candidate, value)) {
          return true;
        }

        if (value.length >= 3 && textContainsWholeTerm(normalizedQuery, value)) {
          return true;
        }

        return false;
      });
    });

    if (hasMatch) {
      matches.push(disease);
    }
  }

  return matches;
}

export function formatSeverityTag(severity: SearchDiseaseRecord["severity"], mandatory: boolean) {
  if (mandatory || severity === "mandatory") {
    return "mandatory";
  }

  if (severity === "high_risk") {
    return "high-risk";
  }

  if (severity === "moderate") {
    return "moderate";
  }

  return "low-risk";
}

export function buildRecommendationAnswer(
  kind: RecommendationKind,
  diseases: SearchDiseaseRecord[],
  regionHint: string | null
) {
  const allVaccines = diseases.flatMap((disease) =>
    disease.vaccines.map((vaccine) => ({ disease, vaccine }))
  );

  if (allVaccines.length === 0) {
    return "I do not have enough vaccine metadata to generate recommendations yet.";
  }

  if (kind === "child_schedule") {
    const childFocused = allVaccines.filter(({ vaccine }) =>
      /child|infant|neonate|pediatric/i.test(vaccine.ageGroup)
    );

    const source = childFocused.length > 0 ? childFocused : allVaccines;
    const picks = source.slice(0, 4);

    const summary = picks
      .map(
        ({ disease, vaccine }) =>
          `${disease.name}: ${vaccine.name} (${vaccine.dosageSchedule}; age group: ${vaccine.ageGroup})`
      )
      .join("; ");

    return `Child vaccination schedule recommendations: ${summary}. Always confirm timing with national immunization guidelines.`;
  }

  if (kind === "travel") {
    const prioritized = allVaccines
      .filter(({ disease, vaccine }) => {
        const regionMatch =
          !regionHint ||
          vaccine.region?.toLowerCase() === regionHint ||
          vaccine.region?.toLowerCase() === "global";

        return regionMatch && (disease.mandatory || disease.severity === "high_risk");
      })
      .slice(0, 5);

    const source = prioritized.length > 0 ? prioritized : allVaccines.slice(0, 5);

    const summary = source
      .map(({ disease, vaccine }) => `${disease.name} (${formatSeverityTag(disease.severity, disease.mandatory)}): ${vaccine.name}`)
      .join(", ");

    return `Travel vaccine recommendations${regionHint ? ` for ${regionHint}` : ""}: ${summary}. Check destination entry requirements and clinician advice before travel.`;
  }

  const top = allVaccines.slice(0, 4);
  const summary = top
    .map(({ disease, vaccine }) => `${disease.name}: ${vaccine.name} (${vaccine.doses})`)
    .join("; ");

  return `General vaccine recommendations based on your query: ${summary}.`;
}
