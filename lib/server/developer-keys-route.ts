import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

type DbClient = PrismaClient | Prisma.TransactionClient;

type SessionResolver = typeof getAuthSession;

type RouteDependencies = {
  db?: DbClient;
  getSession?: SessionResolver;
};

function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function generateApiKey() {
  return `vax_${randomBytes(24).toString("hex")}`;
}

async function getSessionUserId(getSession: SessionResolver) {
  const session = await getSession();
  return session?.user?.id ?? null;
}

type CreateApiKeyBody = {
  name?: string;
  rateLimitPerMinute?: number;
};

type PatchApiKeyBody = {
  keyId?: string;
  action?: "rotate" | "revoke" | "activate";
};

export function createDeveloperKeyHandlers(deps: RouteDependencies = {}) {
  const db = deps.db ?? prisma;
  const getSession = deps.getSession ?? getAuthSession;

  const GET = async () => {
    const userId = await getSessionUserId(getSession);

    if (!userId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const apiKeys = await db.apiKey.findMany({
      where: {
        userId
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        rateLimitPerMinute: true,
        createdAt: true,
        lastUsedAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ apiKeys }, { status: 200 });
  };

  const POST = async (request: Request) => {
    const userId = await getSessionUserId(getSession);

    if (!userId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let payload: CreateApiKeyBody;

    try {
      payload = (await request.json()) as CreateApiKeyBody;
    } catch {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }

    const keyName = payload.name?.trim() || "Default API Key";
    const rateLimitPerMinute = Number(payload.rateLimitPerMinute ?? 60);
    const boundedLimit = Number.isFinite(rateLimitPerMinute)
      ? Math.min(600, Math.max(10, Math.floor(rateLimitPerMinute)))
      : 60;

    const rawKey = generateApiKey();

    const created = await db.apiKey.create({
      data: {
        userId,
        name: keyName,
        prefix: rawKey.slice(0, 10),
        keyHash: hashApiKey(rawKey),
        rateLimitPerMinute: boundedLimit
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        rateLimitPerMinute: true,
        createdAt: true
      }
    });

    return NextResponse.json(
      {
        apiKey: created,
        rawKey
      },
      { status: 201 }
    );
  };

  const PATCH = async (request: Request) => {
    const userId = await getSessionUserId(getSession);

    if (!userId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let payload: PatchApiKeyBody;

    try {
      payload = (await request.json()) as PatchApiKeyBody;
    } catch {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }

    const keyId = payload.keyId?.trim();
    const action = payload.action;

    if (!keyId || !action) {
      return NextResponse.json(
        { message: "keyId and action are required." },
        { status: 400 }
      );
    }

    const existing = await db.apiKey.findFirst({
      where: {
        id: keyId,
        userId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "API key not found." }, { status: 404 });
    }

    if (action === "rotate") {
      const rawKey = generateApiKey();
      const updated = await db.apiKey.update({
        where: {
          id: keyId
        },
        data: {
          keyHash: hashApiKey(rawKey),
          prefix: rawKey.slice(0, 10),
          isActive: true
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          isActive: true,
          rateLimitPerMinute: true,
          createdAt: true,
          lastUsedAt: true
        }
      });

      return NextResponse.json({ apiKey: updated, rawKey }, { status: 200 });
    }

    if (action === "revoke") {
      const updated = await db.apiKey.update({
        where: {
          id: keyId
        },
        data: {
          isActive: false
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          isActive: true,
          rateLimitPerMinute: true,
          createdAt: true,
          lastUsedAt: true
        }
      });

      return NextResponse.json({ apiKey: updated }, { status: 200 });
    }

    if (action === "activate") {
      const updated = await db.apiKey.update({
        where: {
          id: keyId
        },
        data: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          isActive: true,
          rateLimitPerMinute: true,
          createdAt: true,
          lastUsedAt: true
        }
      });

      return NextResponse.json({ apiKey: updated }, { status: 200 });
    }

    return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
  };

  const DELETE = async (request: Request) => {
    const userId = await getSessionUserId(getSession);

    if (!userId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const keyId = new URL(request.url).searchParams.get("keyId")?.trim();
    if (!keyId) {
      return NextResponse.json({ message: "keyId is required." }, { status: 400 });
    }

    const deleted = await db.apiKey.deleteMany({
      where: {
        id: keyId,
        userId
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: "API key not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  };

  return {
    GET,
    POST,
    PATCH,
    DELETE
  };
}
