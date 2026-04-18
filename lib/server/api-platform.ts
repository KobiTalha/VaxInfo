import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

type RateBucket = {
  count: number;
  resetAt: number;
};

type ApiIdentity = {
  apiKeyId: string | null;
  userId: string | null;
  ipAddress: string | null;
  rateLimitPerMinute: number;
  identifier: string;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type ApiGuardOptions = {
  endpoint: string;
  requireApiKey?: boolean;
};

type ApiGuardSuccess = {
  ok: true;
  context: ApiIdentity;
  rateLimit: RateLimitResult;
};

type ApiGuardFailure = {
  ok: false;
  response: NextResponse;
};

type ApiGuardResult = ApiGuardSuccess | ApiGuardFailure;

const inMemoryRateLimiter = new Map<string, RateBucket>();

function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function extractApiKey(request: NextRequest) {
  const headerValue = request.headers.get("x-api-key")?.trim();
  if (headerValue) {
    return headerValue;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip")?.trim() ?? null;
}

function consumeRateLimit(identifier: string, perMinute: number): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000;
  const current = inMemoryRateLimiter.get(identifier);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    inMemoryRateLimiter.set(identifier, {
      count: 1,
      resetAt
    });

    return {
      allowed: true,
      remaining: Math.max(0, perMinute - 1),
      resetAt
    };
  }

  current.count += 1;
  inMemoryRateLimiter.set(identifier, current);

  const allowed = current.count <= perMinute;
  return {
    allowed,
    remaining: Math.max(0, perMinute - current.count),
    resetAt: current.resetAt
  };
}

export async function guardApiRequest(
  request: NextRequest,
  options: ApiGuardOptions
): Promise<ApiGuardResult> {
  const apiKeyRaw = extractApiKey(request);
  const clientIp = getClientIp(request);
  const defaultLimit = Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? "60");

  const shouldRequireApiKey =
    options.requireApiKey ?? process.env.VAXINFO_API_KEYS_REQUIRED === "true";

  if (!apiKeyRaw && shouldRequireApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "API key required. Send x-api-key or Bearer token." },
        { status: 401 }
      )
    };
  }

  if (apiKeyRaw) {
    const keyHash = hashApiKey(apiKeyRaw);
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true
      },
      select: {
        id: true,
        userId: true,
        rateLimitPerMinute: true
      }
    });

    if (!apiKey) {
      return {
        ok: false,
        response: NextResponse.json({ message: "Invalid or inactive API key." }, { status: 401 })
      };
    }

    const identifier = `key:${apiKey.id}`;
    const rateLimit = consumeRateLimit(identifier, apiKey.rateLimitPerMinute || defaultLimit);

    if (!rateLimit.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            message: "Rate limit exceeded for this API key.",
            retryAfterSeconds: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          },
          { status: 429 }
        )
      };
    }

    return {
      ok: true,
      context: {
        apiKeyId: apiKey.id,
        userId: apiKey.userId,
        ipAddress: clientIp,
        rateLimitPerMinute: apiKey.rateLimitPerMinute || defaultLimit,
        identifier
      },
      rateLimit
    };
  }

  const anonymousIdentifier = `ip:${clientIp ?? "unknown"}`;
  const rateLimit = consumeRateLimit(anonymousIdentifier, defaultLimit);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Rate limit exceeded. Provide API key for higher limits.",
          retryAfterSeconds: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
        },
        { status: 429 }
      )
    };
  }

  return {
    ok: true,
    context: {
      apiKeyId: null,
      userId: null,
      ipAddress: clientIp,
      rateLimitPerMinute: defaultLimit,
      identifier: anonymousIdentifier
    },
    rateLimit
  };
}

export async function trackApiUsage(params: {
  endpoint: string;
  method: string;
  statusCode: number;
  apiKeyId?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await prisma.apiUsage.create({
      data: {
        apiKeyId: params.apiKeyId ?? null,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        ipAddress: params.ipAddress ?? null
      }
    });

    if (params.apiKeyId) {
      await prisma.apiKey.update({
        where: {
          id: params.apiKeyId
        },
        data: {
          lastUsedAt: new Date()
        }
      });
    }
  } catch {
    // Swallow usage tracking failures to keep API responses stable.
  }
}
