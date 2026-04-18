import { prisma } from "@/lib/prisma";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        db: "connected",
        uptimeSeconds: Math.floor(process.uptime()),
        latencyMs: Date.now() - startedAt
      },
      { status: 200 }
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        db: "unreachable",
        latencyMs: Date.now() - startedAt
      },
      { status: 503 }
    );
  }
}
