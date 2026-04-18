import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.floor(days))) : 30;
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      usages: {
        where: {
          createdAt: {
            gte: since
          }
        },
        select: {
          endpoint: true,
          statusCode: true,
          createdAt: true
        }
      }
    }
  });

  const usageByEndpoint = new Map<string, number>();
  let totalCalls = 0;
  let errorCalls = 0;

  for (const key of apiKeys) {
    for (const usage of key.usages) {
      totalCalls += 1;
      usageByEndpoint.set(usage.endpoint, (usageByEndpoint.get(usage.endpoint) ?? 0) + 1);

      if (usage.statusCode >= 400) {
        errorCalls += 1;
      }
    }
  }

  return NextResponse.json(
    {
      timeframeDays: safeDays,
      totalCalls,
      errorCalls,
      endpointUsage: [...usageByEndpoint.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([endpoint, count]) => ({ endpoint, count })),
      keys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        calls: key.usages.length
      }))
    },
    { status: 200 }
  );
}
