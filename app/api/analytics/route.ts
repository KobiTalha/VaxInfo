import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardApiRequest, trackApiUsage } from "@/lib/server/api-platform";
import { logServerError } from "@/lib/server/error-log";
import { getSearchAnalytics } from "@/lib/server/search-analytics";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiGuard = await guardApiRequest(request, {
    endpoint: "/api/analytics"
  });

  if (!apiGuard.ok) {
    return apiGuard.response;
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.floor(days))) : 30;

  const authSession = await getAuthSession();
  const userId = authSession?.user?.id ?? apiGuard.context.userId ?? null;

  const finalize = async (body: unknown, status: number) => {
    await trackApiUsage({
      endpoint: "/api/analytics",
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

  try {
    const [searchAnalytics, diseaseStats, userSnapshot] = await Promise.all([
      getSearchAnalytics({ days: safeDays }),
      prisma.disease.findMany({
        select: {
          name: true,
          severity: true,
          mandatory: true,
          vaccines: {
            select: {
              coveragePercent: true,
              region: true
            }
          }
        }
      }),
      userId
        ? prisma.user.findUnique({
            where: {
              id: userId
            },
            select: {
              id: true,
              dashboardPreference: {
                select: {
                  preferredRegion: true
                }
              },
              savedDiseases: {
                include: {
                  disease: {
                    select: {
                      id: true,
                      name: true,
                      severity: true,
                      mandatory: true
                    }
                  }
                },
                orderBy: {
                  createdAt: "desc"
                },
                take: 10
              }
            }
          })
        : Promise.resolve(null)
    ]);

    const severeDiseaseCount = diseaseStats.filter(
      (disease) => disease.severity === "high_risk" || disease.mandatory
    ).length;

    const allCoverageValues = diseaseStats
      .flatMap((disease) => disease.vaccines)
      .map((vaccine) => vaccine.coveragePercent ?? 0);

    const averageCoverage =
      allCoverageValues.length > 0
        ? Number(
            (
              allCoverageValues.reduce((sum, value) => sum + value, 0) / allCoverageValues.length
            ).toFixed(2)
          )
        : 0;

    return finalize(
      {
        timeframeDays: safeDays,
        search: searchAnalytics,
        vaccineIntelligence: {
          totalDiseases: diseaseStats.length,
          highRiskOrMandatoryDiseases: severeDiseaseCount,
          averageCoverage
        },
        userSnapshot: userSnapshot
          ? {
              preferredRegion: userSnapshot.dashboardPreference?.preferredRegion ?? null,
              savedDiseases: userSnapshot.savedDiseases.map((saved) => saved.disease)
            }
          : null
      },
      200
    );
  } catch (error) {
    await logServerError({
      path: request.nextUrl.pathname,
      method: "GET",
      message: error instanceof Error ? error.message : "Analytics API failed",
      stack: error instanceof Error ? error.stack : null,
      metadata: {
        safeDays
      }
    });

    return finalize({ message: "Unable to load analytics." }, 500);
  }
}
