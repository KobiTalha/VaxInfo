import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

let cachedPrisma: PrismaClient | null = null;

function assertSafeTestDatabaseUrl(url: string) {
  const lower = url.toLowerCase();
  const looksLocal =
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("::1") ||
    lower.includes(".internal");
  const looksTest = lower.includes("test") || lower.includes("_ci");

  if (!looksLocal && !looksTest) {
    throw new Error(
      "Refusing to run DB integration tests against non-local/non-test database URL. Set TEST_DATABASE_URL to a dedicated test database."
    );
  }
}

export function hasTestDatabase() {
  return Boolean(process.env.TEST_DATABASE_URL);
}

export function getTestPrismaClient() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is required for DB integration tests.");
  }

  assertSafeTestDatabaseUrl(url);

  if (cachedPrisma) {
    return cachedPrisma;
  }

  cachedPrisma = new PrismaClient({
    datasources: {
      db: {
        url
      }
    }
  });

  return cachedPrisma;
}

class RollbackSignal extends Error {
  value: unknown;

  constructor(value: unknown) {
    super("TRANSACTION_ROLLBACK_SIGNAL");
    this.value = value;
  }
}

export async function withRollbackTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const prisma = getTestPrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      const value = await callback(tx);
      throw new RollbackSignal(value);
    });
  } catch (error) {
    if (error instanceof RollbackSignal) {
      return error.value as T;
    }

    throw error;
  }

  throw new Error("Rollback transaction did not trigger as expected.");
}

export async function createTestUser(tx: Prisma.TransactionClient) {
  const suffix = randomBytes(5).toString("hex");
  return tx.user.create({
    data: {
      email: `route-test-${suffix}@vaxinfo.dev`,
      name: "Route Test User",
      passwordHash: "test-password-hash"
    }
  });
}
