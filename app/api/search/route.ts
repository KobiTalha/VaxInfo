import { prisma } from "@/lib/prisma";
import { guardApiRequest, trackApiUsage } from "@/lib/server/api-platform";
import { getCachedJson, setCachedJson } from "@/lib/server/cache";
import { logServerError } from "@/lib/server/error-log";
import { parsePagination } from "@/lib/server/pagination";
import { recordSearchLog } from "@/lib/server/search-analytics";
import {
    buildRecommendationAnswer,
    detectIntent,
    detectRecommendationKind,
    extractRegionHint,
    formatSeverityTag,
    matchDiseasesFromQuery,
    type SearchDiseaseRecord
} from "@/lib/server/search-intelligence";
import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SearchResponse = {
  query: string;
  intent: "search" | "explanation" | "recommendation" | "analytics";
  recommendationType?: "child_schedule" | "travel" | "general";
  recommendation?: string;
  regionHint?: string | null;
  totalMatches: number;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
  results: Array<{
    id: number;
    disease: string;
    category: string;
    severity: string;
    mandatory: boolean;
    aliases: string[];
    matchType: "exact" | "alias" | "multi" | "fuzzy";
    score: number | null;
    vaccines: Array<{
      id: number;
      name: string;
      type: string;
      vaccineType: string;
      doses: string;
      dosageSchedule: string;
      ageGroup: string;
      sideEffects: string[];
      coveragePercent: number | null;
      region: string | null;
      introductionYear: number | null;
    }>;
  }>;
  disease?: string;
  vaccines?: string[];
  matchType?: "exact" | "alias" | "multi" | "fuzzy";
  score?: number | null;
};

const BASE_SELECT = {
  id: true,
  name: true,
  aliases: true,
  category: true,
  severity: true,
  mandatory: true,
  vaccines: {
    select: {
      id: true,
      name: true,
      type: true,
      vaccineType: true,
      doses: true,
      dosageSchedule: true,
      ageGroup: true,
      sideEffects: true,
      coveragePercent: true,
      region: true,
      introductionYear: true
    }
  }
} as const;

export async function GET(request: NextRequest) {
  const apiGuard = await guardApiRequest(request, {
    endpoint: "/api/search"
  });

  if (!apiGuard.ok) {
    return apiGuard.response;
  }

  const query =
    request.nextUrl.searchParams.get("disease")?.trim() ??
    request.nextUrl.searchParams.get("q")?.trim() ??
    "";

  const pagination = parsePagination(request, {
    page: 1,
    pageSize: 10,
    maxPageSize: 50
  });

  const requestPath = request.nextUrl.pathname;

  const finalize = async (body: unknown, status: number) => {
    await trackApiUsage({
      endpoint: "/api/search",
      method: "GET",
      statusCode: status,
      apiKeyId: apiGuard.context.apiKeyId,
      ipAddress: apiGuard.context.ipAddress
    });

    return NextResponse.json(body, {
      status,
      headers: {
        "x-rate-limit-remaining": String(apiGuard.rateLimit.remaining),
        "x-rate-limit-reset": String(apiGuard.rateLimit.resetAt)
      }
    });
  };

  if (!query) {
    return finalize({ message: "Missing required query parameter: disease or q" }, 400);
  }

  try {
    const cacheKey = `search:${query.toLowerCase()}:p${pagination.page}:s${pagination.pageSize}`;
    const cached = await getCachedJson<SearchResponse>(cacheKey);

    if (cached) {
      return finalize(cached, 200);
    }

    const diseases = (await prisma.disease.findMany({
      select: BASE_SELECT,
      orderBy: {
        name: "asc"
      }
    })) as SearchDiseaseRecord[];

    const intent = detectIntent(query);
    const regionHint = extractRegionHint(query);
    const directMatches = matchDiseasesFromQuery(query, diseases);

    const lowerQuery = query.toLowerCase();

    const exactOrAliasMatches = diseases.filter((disease) => {
      const exact = disease.name.toLowerCase() === lowerQuery;
      const alias = disease.aliases.some((aliasValue) => aliasValue.toLowerCase() === lowerQuery);
      return exact || alias;
    });

    const fuse = new Fuse(diseases, {
      keys: [
        "name",
        "aliases",
        "vaccines.name",
        "vaccines.type",
        "vaccines.vaccineType",
        "category",
        "severity"
      ],
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2
    });

    const fuzzyMatches = fuse.search(query, { limit: 20 });

    const merged = new Map<
      number,
      {
        disease: SearchDiseaseRecord;
        matchType: "exact" | "alias" | "multi" | "fuzzy";
        score: number | null;
      }
    >();

    for (const disease of exactOrAliasMatches) {
      const matchType =
        disease.name.toLowerCase() === lowerQuery ? "exact" : "alias";

      merged.set(disease.id, {
        disease,
        matchType,
        score: matchType === "alias" ? 0 : null
      });
    }

    for (const disease of directMatches) {
      if (!merged.has(disease.id)) {
        merged.set(disease.id, {
          disease,
          matchType: "multi",
          score: 0
        });
      }
    }

    for (const fuzzy of fuzzyMatches) {
      if (!merged.has(fuzzy.item.id)) {
        merged.set(fuzzy.item.id, {
          disease: fuzzy.item,
          matchType: "fuzzy",
          score: fuzzy.score ?? null
        });
      }
    }

    const ranked = [...merged.values()].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      return a.disease.name.localeCompare(b.disease.name);
    });

    if (ranked.length === 0) {
      await recordSearchLog({
        query,
        region: regionHint,
        userId: apiGuard.context.userId
      });

      return finalize({ message: "Disease not found in database", intent }, 404);
    }

    const totalMatches = ranked.length;
    const totalPages = Math.max(1, Math.ceil(totalMatches / pagination.pageSize));
    const start = pagination.skip;
    const end = start + pagination.take;

    const paged = ranked.slice(start, end);

    const response: SearchResponse = {
      query,
      intent,
      regionHint,
      totalMatches,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages
      },
      results: paged.map((entry) => ({
        id: entry.disease.id,
        disease: entry.disease.name,
        category: entry.disease.category,
        severity: formatSeverityTag(entry.disease.severity, entry.disease.mandatory),
        mandatory: entry.disease.mandatory,
        aliases: entry.disease.aliases,
        matchType: entry.matchType,
        score: entry.score,
        vaccines: entry.disease.vaccines
      }))
    };

    if (intent === "recommendation") {
      const recommendationType = detectRecommendationKind(query);
      response.recommendationType = recommendationType;
      response.recommendation = buildRecommendationAnswer(
        recommendationType,
        ranked.slice(0, 8).map((entry) => entry.disease),
        regionHint
      );
    }

    const first = ranked[0];
    if (first) {
      response.disease = first.disease.name;
      response.vaccines = first.disease.vaccines.map((vaccine) => vaccine.name);
      response.matchType = first.matchType;
      response.score = first.score;
    }

    await recordSearchLog({
      query,
      region: regionHint,
      userId: apiGuard.context.userId,
      diseaseIds: ranked.slice(0, 5).map((entry) => entry.disease.id)
    });

    await setCachedJson(cacheKey, response, 120);

    return finalize(response, 200);
  } catch (error) {
    await logServerError({
      path: requestPath,
      method: "GET",
      message: error instanceof Error ? error.message : "Search API failed",
      stack: error instanceof Error ? error.stack : null,
      metadata: {
        query
      }
    });

    return finalize({ message: "Unable to process search request." }, 500);
  }
}
