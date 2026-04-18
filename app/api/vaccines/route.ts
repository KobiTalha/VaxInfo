import { prisma } from "@/lib/prisma";
import { guardApiRequest, trackApiUsage } from "@/lib/server/api-platform";
import { logServerError } from "@/lib/server/error-log";
import { parsePagination } from "@/lib/server/pagination";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiGuard = await guardApiRequest(request, {
    endpoint: "/api/vaccines"
  });

  if (!apiGuard.ok) {
    return apiGuard.response;
  }

  const pagination = parsePagination(request, {
    page: 1,
    pageSize: 50,
    maxPageSize: 200
  });

  const regionFilter = request.nextUrl.searchParams.get("region")?.trim();
  const categoryFilter = request.nextUrl.searchParams.get("category")?.trim();

  const finalize = async (body: unknown, status: number) => {
    await trackApiUsage({
      endpoint: "/api/vaccines",
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
    const where = {
      ...(categoryFilter
        ? {
            category: {
              equals: categoryFilter,
              mode: "insensitive" as const
            }
          }
        : {}),
      ...(regionFilter
        ? {
            vaccines: {
              some: {
                OR: [
                  {
                    region: {
                      equals: regionFilter,
                      mode: "insensitive" as const
                    }
                  },
                  {
                    region: {
                      equals: "Global",
                      mode: "insensitive" as const
                    }
                  }
                ]
              }
            }
          }
        : {})
    };

    const [totalDiseases, diseases] = await Promise.all([
      prisma.disease.count({ where }),
      prisma.disease.findMany({
        where,
        include: {
          vaccines: {
            orderBy: {
              name: "asc"
            }
          }
        },
        orderBy: {
          name: "asc"
        },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    const enriched = diseases.map((disease) => ({
      ...disease,
      hasVaccine: disease.vaccines.length > 0
    }));

    return finalize(
      {
        diseases: enriched,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItems: totalDiseases,
          totalPages: Math.max(1, Math.ceil(totalDiseases / pagination.pageSize))
        }
      },
      200
    );
  } catch (error) {
    await logServerError({
      path: request.nextUrl.pathname,
      method: "GET",
      message: error instanceof Error ? error.message : "Failed to fetch vaccine data",
      stack: error instanceof Error ? error.stack : null,
      metadata: {
        regionFilter,
        categoryFilter
      }
    });

    return finalize({ message: "Unable to fetch vaccine dataset." }, 500);
  }
}
