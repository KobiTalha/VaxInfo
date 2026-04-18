import { prisma } from "@/lib/prisma";

type RecordSearchLogInput = {
  query: string;
  region?: string | null;
  diseaseIds?: number[];
  userId?: string | null;
};

export async function recordSearchLog(input: RecordSearchLogInput) {
  const normalizedQuery = input.query.trim();
  if (!normalizedQuery) {
    return;
  }

  const uniqueDiseaseIds = [...new Set((input.diseaseIds ?? []).filter((id) => Number.isInteger(id)))];

  if (uniqueDiseaseIds.length === 0) {
    await prisma.searchLog.create({
      data: {
        query: normalizedQuery,
        region: input.region ?? null,
        userId: input.userId ?? null
      }
    });

    return;
  }

  await prisma.searchLog.createMany({
    data: uniqueDiseaseIds.map((diseaseId) => ({
      query: normalizedQuery,
      region: input.region ?? null,
      diseaseId,
      userId: input.userId ?? null
    }))
  });
}

type SearchAnalyticsOptions = {
  days?: number;
};

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getSearchAnalytics(options: SearchAnalyticsOptions = {}) {
  const days = Math.min(90, Math.max(1, options.days ?? 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.searchLog.findMany({
    where: {
      createdAt: {
        gte: since
      }
    },
    select: {
      query: true,
      region: true,
      createdAt: true,
      disease: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const queryCount = new Map<string, number>();
  const diseaseCount = new Map<string, number>();
  const regionCount = new Map<string, number>();
  const dailyCount = new Map<string, number>();

  for (const log of logs) {
    queryCount.set(log.query, (queryCount.get(log.query) ?? 0) + 1);

    if (log.disease?.name) {
      diseaseCount.set(log.disease.name, (diseaseCount.get(log.disease.name) ?? 0) + 1);
    }

    if (log.region) {
      regionCount.set(log.region, (regionCount.get(log.region) ?? 0) + 1);
    }

    const key = toDayKey(log.createdAt);
    dailyCount.set(key, (dailyCount.get(key) ?? 0) + 1);
  }

  return {
    totalSearches: logs.length,
    mostSearchedQueries: [...queryCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count })),
    mostSearchedDiseases: [...diseaseCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([disease, count]) => ({ disease, count })),
    regionDemand: [...regionCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([region, count]) => ({ region, count })),
    frequencyOverTime: [...dailyCount.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, count]) => ({ date, count }))
  };
}
