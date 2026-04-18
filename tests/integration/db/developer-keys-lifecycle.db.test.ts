import { createDeveloperKeyHandlers } from "@/lib/server/developer-keys-route";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createTestUser,
    getTestPrismaClient,
    hasTestDatabase,
    withRollbackTransaction
} from "./transactional-db";

type KeyRecord = {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
  lastUsedAt: string | null;
};

describe.skipIf(!hasTestDatabase())("developer key lifecycle route (db)", () => {
  let prisma: ReturnType<typeof getTestPrismaClient> | null = null;

  beforeAll(async () => {
    const client = getTestPrismaClient();
    prisma = client;
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it("creates, rotates, revokes, activates, and deletes API keys", async () => {
    await withRollbackTransaction(async (tx) => {
      const user = await createTestUser(tx);

      const handlers = createDeveloperKeyHandlers({
        db: tx,
        getSession: async () => ({ user: { id: user.id } }) as never
      });

      const createResponse = await handlers.POST(
        new Request("http://localhost/api/developer/keys", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "Route Test Key",
            rateLimitPerMinute: 120
          })
        })
      );

      expect(createResponse.status).toBe(201);
      const createdPayload = (await createResponse.json()) as {
        apiKey: KeyRecord;
        rawKey: string;
      };

      expect(createdPayload.rawKey).toMatch(/^vax_[a-f0-9]+$/);
      expect(createdPayload.apiKey.isActive).toBe(true);

      const rotateResponse = await handlers.PATCH(
        new Request("http://localhost/api/developer/keys", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            keyId: createdPayload.apiKey.id,
            action: "rotate"
          })
        })
      );

      expect(rotateResponse.status).toBe(200);
      const rotatePayload = (await rotateResponse.json()) as {
        apiKey: KeyRecord;
        rawKey: string;
      };

      expect(rotatePayload.rawKey).toMatch(/^vax_[a-f0-9]+$/);
      expect(rotatePayload.rawKey).not.toBe(createdPayload.rawKey);
      expect(rotatePayload.apiKey.isActive).toBe(true);

      const revokeResponse = await handlers.PATCH(
        new Request("http://localhost/api/developer/keys", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            keyId: createdPayload.apiKey.id,
            action: "revoke"
          })
        })
      );

      expect(revokeResponse.status).toBe(200);
      const revokePayload = (await revokeResponse.json()) as {
        apiKey: KeyRecord;
      };
      expect(revokePayload.apiKey.isActive).toBe(false);

      const activateResponse = await handlers.PATCH(
        new Request("http://localhost/api/developer/keys", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            keyId: createdPayload.apiKey.id,
            action: "activate"
          })
        })
      );

      expect(activateResponse.status).toBe(200);
      const activatePayload = (await activateResponse.json()) as {
        apiKey: KeyRecord;
      };
      expect(activatePayload.apiKey.isActive).toBe(true);

      const listResponse = await handlers.GET();
      expect(listResponse.status).toBe(200);

      const listPayload = (await listResponse.json()) as {
        apiKeys: KeyRecord[];
      };
      expect(listPayload.apiKeys.some((entry) => entry.id === createdPayload.apiKey.id)).toBe(true);

      const deleteResponse = await handlers.DELETE(
        new Request(
          `http://localhost/api/developer/keys?keyId=${encodeURIComponent(createdPayload.apiKey.id)}`,
          {
            method: "DELETE"
          }
        )
      );

      expect(deleteResponse.status).toBe(200);

      const afterDeleteResponse = await handlers.GET();
      const afterDeletePayload = (await afterDeleteResponse.json()) as {
        apiKeys: KeyRecord[];
      };

      expect(afterDeletePayload.apiKeys.some((entry) => entry.id === createdPayload.apiKey.id)).toBe(
        false
      );
    });
  });

  it("returns 401 for unauthenticated access", async () => {
    await withRollbackTransaction(async (tx) => {
      const handlers = createDeveloperKeyHandlers({
        db: tx,
        getSession: async () => null as never
      });

      const response = await handlers.GET();
      expect(response.status).toBe(401);
    });
  });
});
