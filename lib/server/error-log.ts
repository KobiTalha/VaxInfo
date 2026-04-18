import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type ErrorLogInput = {
  path: string;
  method: string;
  message: string;
  stack?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logServerError(input: ErrorLogInput) {
  console.error(`[${input.method}] ${input.path}:`, input.message);

  try {
    await prisma.errorLog.create({
      data: {
        path: input.path,
        method: input.method,
        message: input.message,
        stack: input.stack ?? null,
        metadata: input.metadata ?? undefined
      }
    });
  } catch {
    // Intentionally swallow DB logging failures.
  }
}
