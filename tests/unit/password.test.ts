import { hashPassword, verifyPassword } from "@/lib/server/password";
import { describe, expect, it } from "vitest";

describe("password hashing", () => {
  it("verifies a valid password", () => {
    const hash = hashPassword("super-secret");
    expect(verifyPassword("super-secret", hash)).toBe(true);
  });

  it("rejects an invalid password", () => {
    const hash = hashPassword("super-secret");
    expect(verifyPassword("wrong-secret", hash)).toBe(false);
  });
});
